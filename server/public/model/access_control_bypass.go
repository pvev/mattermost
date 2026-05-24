// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "net/http"

const (
	AccessControlBypassSubjectTypeUser = "user"

	AccessControlBypassResourceTypeTeam    = "team"
	AccessControlBypassResourceTypeChannel = "channel"

	AccessControlBypassInviteModeNone   = "none"
	AccessControlBypassInviteModePrompt = "prompt"

	AccessControlBypassStatusActive  = "active"
	AccessControlBypassStatusExpired = "expired"
	AccessControlBypassStatusRevoked = "revoked"

	MaxAccessControlBypassReasonLength = 1024
)

type AccessControlBypassSubject struct {
	Type string `json:"type"`
	ID   string `json:"id"`
}

type AccessControlBypassResource struct {
	Type string `json:"type"`
	ID   string `json:"id"`
}

type AccessControlBypass struct {
	ID string `json:"id"`

	SubjectType string `json:"subject_type"`
	SubjectID   string `json:"subject_id"`

	ResourceType string `json:"resource_type"`
	ResourceID   string `json:"resource_id"`

	Action string `json:"action"`
	Reason string `json:"reason"`

	InviteMode        string `json:"invite_mode,omitempty"`
	AcceptedAt        int64  `json:"accepted_at,omitempty"`
	JoinedAt          int64  `json:"joined_at,omitempty"`
	MembershipCreated bool   `json:"membership_created,omitempty"`

	CreateAt  int64  `json:"create_at"`
	UpdateAt  int64  `json:"update_at"`
	ExpiresAt int64  `json:"expires_at"`
	DeleteAt  int64  `json:"delete_at"`
	CreatedBy string `json:"created_by"`
	DeletedBy string `json:"deleted_by,omitempty"`
}

type AccessControlBypassCreateRequest struct {
	Subjects  []AccessControlBypassSubject  `json:"subjects"`
	Resources []AccessControlBypassResource `json:"resources"`
	Actions   []string                      `json:"actions"`
	ExpiresAt int64                         `json:"expires_at"`
	Reason    string                        `json:"reason"`

	InviteMode string `json:"invite_mode,omitempty"`
}

type AccessControlBypassCreateResponse struct {
	Bypasses []*AccessControlBypass `json:"bypasses"`
}

type AccessControlBypassesWithCount struct {
	Bypasses []*AccessControlBypass `json:"bypasses"`
	Total    int64                  `json:"total"`
}

type AccessControlBypassSearch struct {
	SubjectType  string `json:"subject_type,omitempty"`
	SubjectID    string `json:"subject_id,omitempty"`
	ResourceType string `json:"resource_type,omitempty"`
	ResourceID   string `json:"resource_id,omitempty"`
	Action       string `json:"action,omitempty"`
	CreatedBy    string `json:"created_by,omitempty"`
	Status       string `json:"status,omitempty"`
	Page         int    `json:"page,omitempty"`
	PerPage      int    `json:"per_page,omitempty"`
}

type AccessControlBypassActiveCheck struct {
	SubjectType  string
	SubjectID    string
	ResourceType string
	ResourceID   string
	Action       string
	Now          int64
}

func (b *AccessControlBypass) PreSave() {
	if b.ID == "" {
		b.ID = NewId()
	}

	now := GetMillis()
	if b.CreateAt == 0 {
		b.CreateAt = now
	}
	b.UpdateAt = now

	if b.InviteMode == "" {
		b.InviteMode = AccessControlBypassInviteModeNone
	}
}

func (b *AccessControlBypass) PreUpdate() {
	b.UpdateAt = GetMillis()
}

func (b *AccessControlBypass) Status(now int64) string {
	if b.DeleteAt != 0 {
		return AccessControlBypassStatusRevoked
	}
	if b.ExpiresAt <= now {
		return AccessControlBypassStatusExpired
	}
	return AccessControlBypassStatusActive
}

func (b *AccessControlBypass) Auditable() map[string]any {
	return map[string]any{
		"id":                 b.ID,
		"subject_type":       b.SubjectType,
		"subject_id":         b.SubjectID,
		"resource_type":      b.ResourceType,
		"resource_id":        b.ResourceID,
		"action":             b.Action,
		"invite_mode":        b.InviteMode,
		"membership_created": b.MembershipCreated,
		"create_at":          b.CreateAt,
		"update_at":          b.UpdateAt,
		"expires_at":         b.ExpiresAt,
		"delete_at":          b.DeleteAt,
		"created_by":         b.CreatedBy,
		"deleted_by":         b.DeletedBy,
	}
}

func (b *AccessControlBypass) IsValid() *AppError {
	if b.ID == "" || !IsValidId(b.ID) {
		return NewAppError("AccessControlBypass.IsValid", "model.access_control_bypass.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}
	if b.SubjectType == "" {
		return NewAppError("AccessControlBypass.IsValid", "model.access_control_bypass.is_valid.subject_type.app_error", nil, "", http.StatusBadRequest)
	}
	if b.SubjectID == "" || !IsValidId(b.SubjectID) {
		return NewAppError("AccessControlBypass.IsValid", "model.access_control_bypass.is_valid.subject_id.app_error", nil, "", http.StatusBadRequest)
	}
	switch b.ResourceType {
	case AccessControlBypassResourceTypeTeam, AccessControlBypassResourceTypeChannel:
	default:
		return NewAppError("AccessControlBypass.IsValid", "model.access_control_bypass.is_valid.resource_type.app_error", nil, "", http.StatusBadRequest)
	}
	if b.ResourceID == "" || !IsValidId(b.ResourceID) {
		return NewAppError("AccessControlBypass.IsValid", "model.access_control_bypass.is_valid.resource_id.app_error", nil, "", http.StatusBadRequest)
	}
	if b.Action == "" {
		return NewAppError("AccessControlBypass.IsValid", "model.access_control_bypass.is_valid.action.app_error", nil, "", http.StatusBadRequest)
	}
	if len(b.Reason) > MaxAccessControlBypassReasonLength {
		return NewAppError("AccessControlBypass.IsValid", "model.access_control_bypass.is_valid.reason.app_error", nil, "", http.StatusBadRequest)
	}
	switch b.InviteMode {
	case "", AccessControlBypassInviteModeNone, AccessControlBypassInviteModePrompt:
	default:
		return NewAppError("AccessControlBypass.IsValid", "model.access_control_bypass.is_valid.invite_mode.app_error", nil, "", http.StatusBadRequest)
	}
	if b.ExpiresAt <= b.CreateAt {
		return NewAppError("AccessControlBypass.IsValid", "model.access_control_bypass.is_valid.expires_at.app_error", nil, "", http.StatusBadRequest)
	}
	if b.CreatedBy == "" || !IsValidId(b.CreatedBy) {
		return NewAppError("AccessControlBypass.IsValid", "model.access_control_bypass.is_valid.created_by.app_error", nil, "", http.StatusBadRequest)
	}
	if b.DeletedBy != "" && !IsValidId(b.DeletedBy) {
		return NewAppError("AccessControlBypass.IsValid", "model.access_control_bypass.is_valid.deleted_by.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}
