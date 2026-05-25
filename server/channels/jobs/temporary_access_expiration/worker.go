// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package temporary_access_expiration

import (
	"strconv"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
)

const (
	temporaryAccessExpiryBatchSize        = 200
	temporaryAccessExpiryMaxBatches       = 20
	temporaryAccessExpiryJobBatchWaitTime = 100 * time.Millisecond
)

type AppIface interface {
	ExpireAccessControlTemporaryAccessesBatch(rctx request.CTX, now int64, limit int) (int64, int64, *model.AppError)
}

func MakeWorker(jobServer *jobs.JobServer, app AppIface) *jobs.SimpleWorker {
	const workerName = "AccessControlTemporaryAccessExpiration"

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
		for i := 0; i < temporaryAccessExpiryMaxBatches; i++ {
			time.Sleep(temporaryAccessExpiryJobBatchWaitTime)
			deleted, membershipsRemoved, appErr := app.ExpireAccessControlTemporaryAccessesBatch(request.EmptyContext(logger), now, temporaryAccessExpiryBatchSize)
			if appErr != nil {
				return appErr
			}
			totalDeleted += deleted
			totalMembershipsRemoved += membershipsRemoved
			if deleted < temporaryAccessExpiryBatchSize {
				break
			}
		}

		job.Data["deleted_temporary_access"] = strconv.FormatInt(totalDeleted, 10)
		job.Data["removed_memberships"] = strconv.FormatInt(totalMembershipsRemoved, 10)
		return nil
	}

	return jobs.NewSimpleWorker(workerName, jobServer, execute, isEnabled)
}
