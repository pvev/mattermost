// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {FormattedMessage} from 'react-intl';

import './ephemeral_mode_separator.scss';

/**
 * Divider injected before the first ephemeral DM post in the channel view.
 * Mirrors the visual style of the "New Messages" separator but with green colour
 * to mark the start of the ephemeral session.
 */
const EphemeralModeSeparator = () => {
    return (
        <div className='EphemeralModeSeparator'>
            <hr className='EphemeralModeSeparator__hr'/>
            <div className='EphemeralModeSeparator__text'>
                <i className='icon icon-lock-outline'/>
                <FormattedMessage
                    id='ephemeral_dm.session_start_separator'
                    defaultMessage='Ephemeral mode started'
                />
            </div>
        </div>
    );
};

export default memo(EphemeralModeSeparator);
