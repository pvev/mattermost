// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "net/http"

const (
	AccessControlTemporaryAccessSubjectTypeUser = "user"

	AccessControlTemporaryAccessResourceTypeTeam    = "team"
	AccessControlTemporaryAccessResourceTypeChannel = "channel"

	AccessControlTemporaryAccessInviteModeNone   = "none"
	AccessControlTemporaryAccessInviteModePrompt = "prompt"

	AccessControlTemporaryAccessStatusActive  = "active"
	AccessControlTemporaryAccessStatusExpired = "expired"
	AccessControlTemporaryAccessStatusRevoked = "revoked"

	MaxAccessControlTemporaryAccessReasonLength = 1024
)

type AccessControlTemporaryAccessSubject struct {
	Type string `json:"type"`
	ID   string `json:"id"`
}

type AccessControlTemporaryAccessResource struct {
	Type string `json:"type"`
	ID   string `json:"id"`
}

type AccessControlTemporaryAccess struct {
	ID string `json:"id"`

	SubjectType string `json:"subject_type"`
	SubjectID   string `json:"subject_id"`

	ResourceType string `json:"resource_type"`
	ResourceID   string `json:"resource_id"`

	Action string `json:"action"`
	Reason string `json:"reason"`

	InviteMode            string `json:"invite_mode,omitempty"`
	AcceptedAt            int64  `json:"accepted_at,omitempty"`
	JoinedAt              int64  `json:"joined_at,omitempty"`
	MembershipCreated     bool   `json:"membership_created,omitempty"`
	TeamMembershipCreated bool   `json:"team_membership_created,omitempty"`

	CreateAt  int64  `json:"create_at"`
	UpdateAt  int64  `json:"update_at"`
	ExpiresAt int64  `json:"expires_at"`
	DeleteAt  int64  `json:"delete_at"`
	CreatedBy string `json:"created_by"`
	DeletedBy string `json:"deleted_by,omitempty"`
}

type AccessControlTemporaryAccessCreateRequest struct {
	Subjects  []AccessControlTemporaryAccessSubject  `json:"subjects"`
	Resources []AccessControlTemporaryAccessResource `json:"resources"`
	Actions   []string                               `json:"actions"`
	ExpiresAt int64                                  `json:"expires_at"`
	Reason    string                                 `json:"reason"`

	InviteMode string `json:"invite_mode,omitempty"`
}

type AccessControlTemporaryAccessCreateResponse struct {
	TemporaryAccesses []*AccessControlTemporaryAccess `json:"temporary_accesses"`
}

type AccessControlTemporaryAccessesWithCount struct {
	TemporaryAccesses []*AccessControlTemporaryAccess `json:"temporary_accesses"`
	Total             int64                           `json:"total"`
}

type AccessControlTemporaryAccessSearch struct {
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

type AccessControlTemporaryAccessActiveCheck struct {
	SubjectType  string
	SubjectID    string
	ResourceType string
	ResourceID   string
	Action       string
	Now          int64
}

func (b *AccessControlTemporaryAccess) PreSave() {
	if b.ID == "" {
		b.ID = NewId()
	}

	now := GetMillis()
	if b.CreateAt == 0 {
		b.CreateAt = now
	}
	b.UpdateAt = now

	if b.InviteMode == "" {
		b.InviteMode = AccessControlTemporaryAccessInviteModeNone
	}
}

func (b *AccessControlTemporaryAccess) PreUpdate() {
	b.UpdateAt = GetMillis()
}

func (b *AccessControlTemporaryAccess) Status(now int64) string {
	if b.DeleteAt != 0 {
		return AccessControlTemporaryAccessStatusRevoked
	}
	if b.ExpiresAt <= now {
		return AccessControlTemporaryAccessStatusExpired
	}
	return AccessControlTemporaryAccessStatusActive
}

func (b *AccessControlTemporaryAccess) Auditable() map[string]any {
	return map[string]any{
		"id":                      b.ID,
		"subject_type":            b.SubjectType,
		"subject_id":              b.SubjectID,
		"resource_type":           b.ResourceType,
		"resource_id":             b.ResourceID,
		"action":                  b.Action,
		"invite_mode":             b.InviteMode,
		"membership_created":      b.MembershipCreated,
		"team_membership_created": b.TeamMembershipCreated,
		"create_at":               b.CreateAt,
		"update_at":               b.UpdateAt,
		"expires_at":              b.ExpiresAt,
		"delete_at":               b.DeleteAt,
		"created_by":              b.CreatedBy,
		"deleted_by":              b.DeletedBy,
	}
}

func (b *AccessControlTemporaryAccess) IsValid() *AppError {
	if b.ID == "" || !IsValidId(b.ID) {
		return NewAppError("AccessControlTemporaryAccess.IsValid", "model.access_control_temporary_access.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}
	if b.SubjectType == "" {
		return NewAppError("AccessControlTemporaryAccess.IsValid", "model.access_control_temporary_access.is_valid.subject_type.app_error", nil, "", http.StatusBadRequest)
	}
	if b.SubjectID == "" || !IsValidId(b.SubjectID) {
		return NewAppError("AccessControlTemporaryAccess.IsValid", "model.access_control_temporary_access.is_valid.subject_id.app_error", nil, "", http.StatusBadRequest)
	}
	switch b.ResourceType {
	case AccessControlTemporaryAccessResourceTypeTeam, AccessControlTemporaryAccessResourceTypeChannel:
	default:
		return NewAppError("AccessControlTemporaryAccess.IsValid", "model.access_control_temporary_access.is_valid.resource_type.app_error", nil, "", http.StatusBadRequest)
	}
	if b.ResourceID == "" || !IsValidId(b.ResourceID) {
		return NewAppError("AccessControlTemporaryAccess.IsValid", "model.access_control_temporary_access.is_valid.resource_id.app_error", nil, "", http.StatusBadRequest)
	}
	if b.Action == "" {
		return NewAppError("AccessControlTemporaryAccess.IsValid", "model.access_control_temporary_access.is_valid.action.app_error", nil, "", http.StatusBadRequest)
	}
	if len(b.Reason) > MaxAccessControlTemporaryAccessReasonLength {
		return NewAppError("AccessControlTemporaryAccess.IsValid", "model.access_control_temporary_access.is_valid.reason.app_error", nil, "", http.StatusBadRequest)
	}
	switch b.InviteMode {
	case "", AccessControlTemporaryAccessInviteModeNone, AccessControlTemporaryAccessInviteModePrompt:
	default:
		return NewAppError("AccessControlTemporaryAccess.IsValid", "model.access_control_temporary_access.is_valid.invite_mode.app_error", nil, "", http.StatusBadRequest)
	}
	if b.ExpiresAt <= b.CreateAt {
		return NewAppError("AccessControlTemporaryAccess.IsValid", "model.access_control_temporary_access.is_valid.expires_at.app_error", nil, "", http.StatusBadRequest)
	}
	if b.CreatedBy == "" || !IsValidId(b.CreatedBy) {
		return NewAppError("AccessControlTemporaryAccess.IsValid", "model.access_control_temporary_access.is_valid.created_by.app_error", nil, "", http.StatusBadRequest)
	}
	if b.DeletedBy != "" && !IsValidId(b.DeletedBy) {
		return NewAppError("AccessControlTemporaryAccess.IsValid", "model.access_control_temporary_access.is_valid.deleted_by.app_error", nil, "", http.StatusBadRequest)
	}

	return nil
}
