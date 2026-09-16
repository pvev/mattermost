// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {useEffect, useState} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import type {PropertyField} from '@mattermost/types/properties';
import type {GlobalState} from '@mattermost/types/store';

import {PropertyTypes} from 'mattermost-redux/action_types';
import {Client4} from 'mattermost-redux/client';
import {ACCESS_CONTROL_PROPERTY_GROUP, CHANNEL_OBJECT_TYPE} from 'mattermost-redux/constants/properties';
import {getPropertyValueForTargetField} from 'mattermost-redux/selectors/entities/properties';
import {isPropertyFieldRequired, isPropertyValueSet} from 'mattermost-redux/utils/property_utils';

import useChannelAttributes from './useChannelAttributes';

export type MissingRequiredChannelAttributesState = {
    loading: boolean;
    missing: PropertyField[];
};

/**
 * Reports which required channel attributes lack a value on this channel --
 * the advisory check behind the unarchive warning (MM-70717; unarchive itself
 * is warn-only and never blocked on this).
 *
 * Fails open: a fetch error yields an empty `missing` list rather than a
 * stuck warning, since this is advisory only and must never block a restore
 * over a side request failing.
 */
export default function useMissingRequiredChannelAttributes(channelId: string): MissingRequiredChannelAttributesState {
    const dispatch = useDispatch();

    const {enabled, loading: fieldsLoading, fields} = useChannelAttributes();
    const requiredFields = fields.filter(isPropertyFieldRequired);

    const [valuesLoaded, setValuesLoaded] = useState(false);

    useEffect(() => {
        if (!enabled || requiredFields.length === 0) {
            return;
        }

        Client4.getPropertyValues(ACCESS_CONTROL_PROPERTY_GROUP, CHANNEL_OBJECT_TYPE, channelId).then((values) => {
            if (values && values.length > 0) {
                dispatch({
                    type: PropertyTypes.RECEIVED_PROPERTY_VALUES,
                    data: {values},
                });
            }
            setValuesLoaded(true);
        }).catch(() => {
            // Fail open -- see doc comment above.
            setValuesLoaded(true);
        });

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, channelId, requiredFields.length]);

    const missing = useSelector((state: GlobalState) => {
        if (!enabled) {
            return [];
        }
        return requiredFields.filter((field) => {
            const value = getPropertyValueForTargetField(state, channelId, field.id);
            return !isPropertyValueSet(value?.value);
        });
    });

    return {
        loading: fieldsLoading || (requiredFields.length > 0 && !valuesLoaded),
        missing: enabled ? missing : [],
    };
}
