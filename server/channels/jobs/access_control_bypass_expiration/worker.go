// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package access_control_bypass_expiration

import (
	"strconv"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
)

const (
	bypassExpiryBatchSize        = 200
	bypassExpiryMaxBatches       = 20
	bypassExpiryJobBatchWaitTime = 100 * time.Millisecond
)

type AppIface interface {
	ExpireAccessControlBypassesBatch(rctx request.CTX, now int64, limit int) (int64, int64, *model.AppError)
}

func MakeWorker(jobServer *jobs.JobServer, app AppIface) *jobs.SimpleWorker {
	const workerName = "AccessControlBypassExpiration"

	isEnabled := func(cfg *model.Config) bool {
		return cfg.FeatureFlags.AttributeBasedAccessControl
	}
	execute := func(logger mlog.LoggerIFace, job *model.Job) error {
		if job.Data == nil {
			job.Data = make(model.StringMap)
		}

		now := model.GetMillis()
		var totalDeleted int64
		var totalMembershipsRemoved int64
		for i := 0; i < bypassExpiryMaxBatches; i++ {
			time.Sleep(bypassExpiryJobBatchWaitTime)
			deleted, membershipsRemoved, appErr := app.ExpireAccessControlBypassesBatch(request.EmptyContext(logger), now, bypassExpiryBatchSize)
			if appErr != nil {
				return appErr
			}
			totalDeleted += deleted
			totalMembershipsRemoved += membershipsRemoved
			if deleted < bypassExpiryBatchSize {
				break
			}
		}

		job.Data["deleted_bypasses"] = strconv.FormatInt(totalDeleted, 10)
		job.Data["removed_memberships"] = strconv.FormatInt(totalMembershipsRemoved, 10)
		return nil
	}

	return jobs.NewSimpleWorker(workerName, jobServer, execute, isEnabled)
}
