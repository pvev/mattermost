// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// SKUs
const TrackProfessionalSKU = 'professional';
const TrackEnterpriseSKU = 'enterprise';

// Features
export const TrackGroupsFeature = 'custom_groups';
export const TrackPassiveKeywordsFeature = 'passive_keywords';
export const TrackScheduledPostsFeature = 'scheduled_posts';

// Events
export const TrackInviteGroupEvent = 'invite_group_to_channel__add_member';
export const TrackPassiveKeywordsEvent = 'update_passive_keywords';

// Categories
const TrackActionCategory = 'action';
export const TrackMiscCategory = 'miscellaneous';

// Properties
export const TrackPropertyUser = 'user_actual_id';
export const TrackPropertyUserAgent = 'user_agent';

export const eventSKUs: {[event: string]: string[]} = {
    [TrackInviteGroupEvent]: [TrackProfessionalSKU, TrackEnterpriseSKU],
    [TrackPassiveKeywordsEvent]: [TrackProfessionalSKU, TrackEnterpriseSKU],
};

export const eventCategory: {[event: string]: string} = {
    [TrackInviteGroupEvent]: TrackActionCategory,
    [TrackPassiveKeywordsEvent]: TrackActionCategory,
};
