// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func (a *App) HasActiveAccessControlTemporaryAccessForRequest(rctx request.CTX, accessRequest model.AccessRequest) (bool, *model.AppError) {
	if accessRequest.Subject.Type != model.AccessControlTemporaryAccessSubjectTypeUser {
		return false, nil
	}
	if accessRequest.Subject.ID == "" || accessRequest.Resource.ID == "" || accessRequest.Action == "" {
		return false, nil
	}

	allowed, appErr := a.hasActiveAccessControlTemporaryAccess(rctx, model.AccessControlTemporaryAccessActiveCheck{
		SubjectType:  model.AccessControlTemporaryAccessSubjectTypeUser,
		SubjectID:    accessRequest.Subject.ID,
		ResourceType: accessRequest.Resource.Type,
		ResourceID:   accessRequest.Resource.ID,
		Action:       accessRequest.Action,
	})
	if appErr != nil || allowed {
		return allowed, appErr
	}

	if accessRequest.Resource.Type != model.AccessControlTemporaryAccessResourceTypeChannel {
		return false, nil
	}

	channel, channelErr := a.GetChannel(rctx, accessRequest.Resource.ID)
	if channelErr != nil {
		if channelErr.StatusCode == http.StatusNotFound {
			return false, nil
		}
		return false, channelErr
	}
	if channel.TeamId == "" {
		return false, nil
	}

	return a.hasActiveAccessControlTemporaryAccess(rctx, model.AccessControlTemporaryAccessActiveCheck{
		SubjectType:  model.AccessControlTemporaryAccessSubjectTypeUser,
		SubjectID:    accessRequest.Subject.ID,
		ResourceType: model.AccessControlTemporaryAccessResourceTypeTeam,
		ResourceID:   channel.TeamId,
		Action:       accessRequest.Action,
	})
}

func (a *App) hasActiveAccessControlTemporaryAccess(rctx request.CTX, check model.AccessControlTemporaryAccessActiveCheck) (bool, *model.AppError) {
	allowed, err := a.Srv().Store().AccessControlTemporaryAccess().HasActive(rctx, check)
	if err != nil {
		var invalid *store.ErrInvalidInput
		if errors.As(err, &invalid) {
			return false, model.NewAppError("HasActiveAccessControlTemporaryAccessForRequest", "app.access_control_temporary_access.has_active.invalid.app_error", nil, "", http.StatusBadRequest).Wrap(err)
		}
		return false, model.NewAppError("HasActiveAccessControlTemporaryAccessForRequest", "app.access_control_temporary_access.has_active.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return allowed, nil
}
