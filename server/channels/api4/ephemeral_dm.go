// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"encoding/json"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func (api *API) InitEphemeralDM() {
	// Handshake routes
	api.BaseRoutes.Channel.Handle("/ephemeral-mode/request", api.APISessionRequired(requestEphemeralMode)).Methods(http.MethodPost)
	api.BaseRoutes.Channel.Handle("/ephemeral-mode/accept", api.APISessionRequired(acceptEphemeralMode)).Methods(http.MethodPost)
	api.BaseRoutes.Channel.Handle("/ephemeral-mode/decline", api.APISessionRequired(declineEphemeralMode)).Methods(http.MethodPost)
	// end supports both manual stop and navigator.sendBeacon (empty body ok)
	api.BaseRoutes.Channel.Handle("/ephemeral-mode/end", api.APISessionRequired(endEphemeralMode)).Methods(http.MethodPost)
	// Post sending without persistence
	api.BaseRoutes.Channel.Handle("/ephemeral-mode/posts", api.APISessionRequired(sendEphemeralDMPost)).Methods(http.MethodPost)
}

func requestEphemeralMode(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	userID := c.AppContext.Session().UserId
	if appErr := c.App.RequestEphemeralMode(c.AppContext, userID, c.Params.ChannelId); appErr != nil {
		c.Err = appErr
		return
	}

	ReturnStatusOK(w)
}

func acceptEphemeralMode(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	userID := c.AppContext.Session().UserId
	if appErr := c.App.AcceptEphemeralMode(c.AppContext, userID, c.Params.ChannelId); appErr != nil {
		c.Err = appErr
		return
	}

	ReturnStatusOK(w)
}

func declineEphemeralMode(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	userID := c.AppContext.Session().UserId
	if appErr := c.App.DeclineEphemeralMode(c.AppContext, userID, c.Params.ChannelId); appErr != nil {
		c.Err = appErr
		return
	}

	ReturnStatusOK(w)
}

func endEphemeralMode(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	// Parse optional reason from body (sendBeacon may send an empty body)
	reason := "manual"
	var body struct {
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err == nil && body.Reason != "" {
		reason = body.Reason
	}

	userID := c.AppContext.Session().UserId
	if appErr := c.App.EndEphemeralMode(c.AppContext, userID, c.Params.ChannelId, reason); appErr != nil {
		c.Err = appErr
		return
	}

	ReturnStatusOK(w)
}

func sendEphemeralDMPost(c *Context, w http.ResponseWriter, r *http.Request) {
	c.RequireChannelId()
	if c.Err != nil {
		return
	}

	var post model.Post
	if err := json.NewDecoder(r.Body).Decode(&post); err != nil {
		c.SetInvalidParamWithErr("post", err)
		return
	}

	post.ChannelId = c.Params.ChannelId
	post.UserId = c.AppContext.Session().UserId

	result, appErr := c.App.SendEphemeralDMPost(c.AppContext, post.UserId, post.ChannelId, &post)
	if appErr != nil {
		c.Err = appErr
		return
	}

	w.WriteHeader(http.StatusCreated)
	if result != nil {
		if err := result.EncodeJSON(w); err != nil {
			c.Logger.Warn("Error while writing response", mlog.Err(err))
		}
	}
}
