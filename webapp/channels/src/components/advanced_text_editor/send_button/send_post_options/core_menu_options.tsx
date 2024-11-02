// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import moment from 'moment';
import React, {memo, useCallback} from 'react';
import {FormattedMessage} from 'react-intl';

import useTimePostBoxIndicator from 'components/advanced_text_editor/use_post_box_indicator';
import * as Menu from 'components/menu';
import type {Props as MenuItemProps} from 'components/menu/menu_item';
import Timestamp from 'components/timestamp';

type Props = {
    handleOnSelect: (e: React.FormEvent, scheduledAt: number) => void;
    channelId: string;
}

function CoreMenuOptions({handleOnSelect, channelId}: Props) {
    const {
        userCurrentTimezone,
        teammateTimezone,
        teammateDisplayName,
        isDM,
    } = useTimePostBoxIndicator(channelId);

    const today = moment().tz(userCurrentTimezone);
    const tomorrow9amTime = moment().
        tz(userCurrentTimezone).
        add(1, 'days').
        set({hour: 9, minute: 0, second: 0, millisecond: 0}).
        valueOf();

    const timeComponent = (
        <Timestamp
            value={tomorrow9amTime.valueOf()}
            useDate={false}
        />
    );

    const extraProps: Partial<MenuItemProps> = {};

    if (isDM) {
        function getScheduledTimeInTeammateTimezone(userCurrentTimestamp: number, teammateTimezoneString: string): string {
            const scheduledTimeUTC = moment.utc(userCurrentTimestamp);

            const teammateScheduledTime = scheduledTimeUTC.clone().tz(teammateTimezoneString);

            const formattedTime = teammateScheduledTime.format('h:mm A');

            return formattedTime;
        }

        const teammateTimezoneString = teammateTimezone.useAutomaticTimezone ? teammateTimezone.automaticTimezone : teammateTimezone.manualTimezone || 'UTC';

        const dmTeammateTimezone = (
            <FormattedMessage
                id='create_post_button.option.schedule_message.options.teammate_user_hour'
                defaultMessage="{time} {user}'s time"
                values={{
                    user: (
                        <span className='userDisplayName'>
                            {teammateDisplayName}
                        </span>
                    ),
                    time: getScheduledTimeInTeammateTimezone(tomorrow9amTime, teammateTimezoneString),
                }}
            />
        );

        extraProps.trailingElements = dmTeammateTimezone;
    }

    const tomorrowClickHandler = useCallback((e) => handleOnSelect(e, tomorrow9amTime), [handleOnSelect, tomorrow9amTime]);

    const optionTomorrow = (
        <Menu.Item
            key={'scheduling_time_tomorrow_9_am'}
            onClick={tomorrowClickHandler}
            labels={
                <FormattedMessage
                    id='create_post_button.option.schedule_message.options.tomorrow'
                    defaultMessage='Tomorrow at {9amTime}'
                    values={{'9amTime': timeComponent}}
                />
            }
            className='core-menu-options'
            {...extraProps}
        />
    );

    const nextMonday = moment().
        tz(userCurrentTimezone).
        day(8). // next monday; 1 = Monday, 8 = next Monday
        set({hour: 9, minute: 0, second: 0, millisecond: 0}). // 9 AM
        valueOf();

    const nextMondayClickHandler = useCallback((e) => handleOnSelect(e, nextMonday), [handleOnSelect, nextMonday]);

    const optionNextMonday = (
        <Menu.Item
            key={'scheduling_time_next_monday_9_am'}
            onClick={nextMondayClickHandler}
            labels={
                <FormattedMessage
                    id='create_post_button.option.schedule_message.options.next_monday'
                    defaultMessage='Next Monday at {9amTime}'
                    values={{'9amTime': timeComponent}}
                />
            }
            className='core-menu-options'
            {...extraProps}
        />
    );

    const optionMonday = (
        <Menu.Item
            key={'scheduling_time_monday_9_am'}
            onClick={nextMondayClickHandler}
            labels={
                <FormattedMessage
                    id='create_post_button.option.schedule_message.options.monday'
                    defaultMessage='Monday at {9amTime}'
                    values={{
                        '9amTime': timeComponent,
                    }}
                />
            }
            className='core-menu-options'
            {...extraProps}
        />
    );

    let options: React.ReactElement[] = [];

    switch (today.day()) {
    // Sunday
    case 0:
        options = [optionTomorrow];
        break;

        // Monday
    case 1:
        options = [optionTomorrow, optionNextMonday];
        break;

        // Friday and Saturday
    case 5:
    case 6:
        options = [optionMonday];
        break;

        // Tuesday to Thursday
    default:
        options = [optionTomorrow, optionMonday];
    }

    return (
        <>
            {options}
        </>
    );
}

export default memo(CoreMenuOptions);
