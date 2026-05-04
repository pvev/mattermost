// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

const (
	ephemeralDMInactivityTimeout = 60 * time.Minute
	ephemeralDMCleanupInterval   = 5 * time.Minute
)

// ephemeralDMSession tracks an active ephemeral DM session between two users.
type ephemeralDMSession struct {
	mu           sync.Mutex
	channelID    string
	member1      string
	member2      string
	lastActivity time.Time
}

func (s *ephemeralDMSession) touchActivity() {
	s.mu.Lock()
	s.lastActivity = time.Now()
	s.mu.Unlock()
}

func (s *ephemeralDMSession) isInactive() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return time.Since(s.lastActivity) > ephemeralDMInactivityTimeout
}

func (s *ephemeralDMSession) otherMember(userID string) string {
	if s.member1 == userID {
		return s.member2
	}
	return s.member1
}

// Package-level session registry: channelID -> *ephemeralDMSession
var ephemeralDMSessions sync.Map

func ephemeralDMSessionByUserID(userID string) *ephemeralDMSession {
	var found *ephemeralDMSession
	ephemeralDMSessions.Range(func(_, v any) bool {
		s := v.(*ephemeralDMSession)
		if s.member1 == userID || s.member2 == userID {
			found = s
			return false
		}
		return true
	})
	return found
}

// StartEphemeralDMInactivityReaper starts a background goroutine that ends
// idle ephemeral DM sessions. It stops when stopChan is closed.
func (a *App) StartEphemeralDMInactivityReaper(stopChan <-chan struct{}) {
	go func() {
		ticker := time.NewTicker(ephemeralDMCleanupInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				ephemeralDMSessions.Range(func(k, v any) bool {
					s := v.(*ephemeralDMSession)
					if s.isInactive() {
						a.endEphemeralModeInternal(request.EmptyContext(a.Log()), s, "inactivity")
					}
					return true
				})
			case <-stopChan:
				return
			}
		}
	}()
}

// RequestEphemeralMode initiates an ephemeral mode handshake from userID in the given DM channel.
func (a *App) RequestEphemeralMode(rctx request.CTX, userID, channelID string) *model.AppError {
	channel, appErr := a.GetChannel(rctx, channelID)
	if appErr != nil {
		return appErr
	}
	if channel.Type != model.ChannelTypeDirect {
		return model.NewAppError("RequestEphemeralMode", "app.ephemeral_dm.not_direct_channel", nil, "", http.StatusBadRequest)
	}

	m1, m2 := channel.GetBothUsersForDM()
	if m1 == "" || m2 == "" {
		return model.NewAppError("RequestEphemeralMode", "app.ephemeral_dm.cannot_parse_members", nil, "", http.StatusInternalServerError)
	}
	if m1 != userID && m2 != userID {
		return model.NewAppError("RequestEphemeralMode", "app.ephemeral_dm.not_member", nil, "", http.StatusForbidden)
	}

	if _, exists := ephemeralDMSessions.Load(channelID); exists {
		return model.NewAppError("RequestEphemeralMode", "app.ephemeral_dm.already_active", nil, "", http.StatusConflict)
	}

	for _, memberID := range []string{m1, m2} {
		evt := model.NewWebSocketEvent(model.WebsocketEventEphemeralModeRequested, "", channelID, memberID, nil, "")
		evt.Add("from_user_id", userID)
		evt.Add("channel_id", channelID)
		a.Publish(evt)
	}
	return nil
}

// AcceptEphemeralMode finalises the handshake and marks the session active.
func (a *App) AcceptEphemeralMode(rctx request.CTX, userID, channelID string) *model.AppError {
	channel, appErr := a.GetChannel(rctx, channelID)
	if appErr != nil {
		return appErr
	}
	if channel.Type != model.ChannelTypeDirect {
		return model.NewAppError("AcceptEphemeralMode", "app.ephemeral_dm.not_direct_channel", nil, "", http.StatusBadRequest)
	}

	m1, m2 := channel.GetBothUsersForDM()
	if m1 == "" || m2 == "" {
		return model.NewAppError("AcceptEphemeralMode", "app.ephemeral_dm.cannot_parse_members", nil, "", http.StatusInternalServerError)
	}
	if m1 != userID && m2 != userID {
		return model.NewAppError("AcceptEphemeralMode", "app.ephemeral_dm.not_member", nil, "", http.StatusForbidden)
	}

	session := &ephemeralDMSession{
		channelID:    channelID,
		member1:      m1,
		member2:      m2,
		lastActivity: time.Now(),
	}
	ephemeralDMSessions.Store(channelID, session)

	for _, memberID := range []string{m1, m2} {
		evt := model.NewWebSocketEvent(model.WebsocketEventEphemeralModeActive, "", channelID, memberID, nil, "")
		evt.Add("channel_id", channelID)
		a.Publish(evt)
	}
	return nil
}

// DeclineEphemeralMode notifies both members that the request was declined.
func (a *App) DeclineEphemeralMode(rctx request.CTX, userID, channelID string) *model.AppError {
	channel, appErr := a.GetChannel(rctx, channelID)
	if appErr != nil {
		return appErr
	}
	if channel.Type != model.ChannelTypeDirect {
		return model.NewAppError("DeclineEphemeralMode", "app.ephemeral_dm.not_direct_channel", nil, "", http.StatusBadRequest)
	}

	m1, m2 := channel.GetBothUsersForDM()
	if m1 == "" || m2 == "" {
		return model.NewAppError("DeclineEphemeralMode", "app.ephemeral_dm.cannot_parse_members", nil, "", http.StatusInternalServerError)
	}

	for _, memberID := range []string{m1, m2} {
		evt := model.NewWebSocketEvent(model.WebsocketEventEphemeralModeDeclined, "", channelID, memberID, nil, "")
		evt.Add("channel_id", channelID)
		evt.Add("declined_by", userID)
		a.Publish(evt)
	}
	return nil
}

// SendEphemeralDMPost routes a post through WebSocket only — no DB persistence.
// It updates the session's lastActivity so the inactivity timer is reset.
//
// Unlike the generic SendEphemeralPost helper, this does NOT set
// post.Type = "system_ephemeral". That type causes the frontend to render the
// post under the "System" username. Instead the post is sent with its natural
// type (empty = regular message) so the real sender name is displayed.
func (a *App) SendEphemeralDMPost(rctx request.CTX, userID, channelID string, post *model.Post) (*model.Post, *model.AppError) {
	v, exists := ephemeralDMSessions.Load(channelID)
	if !exists {
		return nil, model.NewAppError("SendEphemeralDMPost", "app.ephemeral_dm.session_not_active", nil, "", http.StatusBadRequest)
	}
	session := v.(*ephemeralDMSession)
	session.touchActivity()

	// Populate required fields that would normally be set by the DB layer.
	post.UserId = userID
	post.ChannelId = channelID
	if post.Id == "" {
		post.Id = model.NewId()
	}
	if post.CreateAt == 0 {
		post.CreateAt = model.GetMillis()
	}
	if post.Props == nil {
		post.Props = make(model.StringInterface)
	}
	post.Props["ephemeral_dm"] = true
	// Leave post.Type as "" (regular post) so the frontend does not treat it
	// as a system message and shows the real sender's username/avatar.

	postJSON, jsonErr := post.ToJSON()
	if jsonErr != nil {
		rctx.Logger().Warn("ephemeral_dm: failed to JSON-encode post", mlog.Err(jsonErr))
	}

	for _, memberID := range []string{session.member1, session.member2} {
		evt := model.NewWebSocketEvent(model.WebsocketEventEphemeralMessage, "", channelID, memberID, nil, "")
		evt.Add("post", postJSON)
		a.Publish(evt)
	}
	return post, nil
}

// EndEphemeralMode terminates an active session, notifying both members.
// reason should be one of: "manual", "peer_disconnected", "inactivity", "server_restart".
func (a *App) EndEphemeralMode(rctx request.CTX, userID, channelID, reason string) *model.AppError {
	v, exists := ephemeralDMSessions.Load(channelID)
	if !exists {
		return nil
	}
	return a.endEphemeralModeInternal(rctx, v.(*ephemeralDMSession), reason)
}

func (a *App) endEphemeralModeInternal(rctx request.CTX, session *ephemeralDMSession, reason string) *model.AppError {
	channelID := session.channelID
	ephemeralDMSessions.Delete(channelID)

	for _, memberID := range []string{session.member1, session.member2} {
		evt := model.NewWebSocketEvent(model.WebsocketEventEphemeralModeEnded, "", channelID, memberID, nil, "")
		evt.Add("channel_id", channelID)
		evt.Add("reason", reason)
		a.Publish(evt)
	}
	return nil
}

// OnUserDisconnectedForEphemeralDM is called by the platform hub when a user's
// last WebSocket connection closes. If the user is a member of an active
// ephemeral DM session, that session is terminated and the peer is notified.
func (a *App) OnUserDisconnectedForEphemeralDM(userID string) {
	session := ephemeralDMSessionByUserID(userID)
	if session == nil {
		return
	}
	rctx := request.EmptyContext(a.Log())
	if err := a.endEphemeralModeInternal(rctx, session, "peer_disconnected"); err != nil {
		rctx.Logger().Error("Failed to end ephemeral DM session on disconnect",
			mlog.String("user_id", userID),
			mlog.String("channel_id", session.channelID),
			mlog.Err(err),
		)
	}
}
