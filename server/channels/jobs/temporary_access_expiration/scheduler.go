// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package temporary_access_expiration

import (
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
)

const schedFreq = time.Minute

func MakeScheduler(jobServer *jobs.JobServer) *jobs.PeriodicScheduler {
	isEnabled := func(cfg *model.Config) bool {
		return cfg.FeatureFlags.AttributeBasedAccessControl
	}
	return jobs.NewPeriodicScheduler(jobServer, model.JobTypeAccessControlTemporaryAccessExpiration, schedFreq, isEnabled)
}
