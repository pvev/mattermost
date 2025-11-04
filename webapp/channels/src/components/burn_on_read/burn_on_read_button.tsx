// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {memo} from 'react';
import {useIntl} from 'react-intl';
import classNames from 'classnames';

import {FireIcon} from '@mattermost/compass-icons/components';

import {IconContainer} from 'components/advanced_text_editor/formatting_bar/formatting_icon';
import WithTooltip from 'components/with_tooltip';

type Props = {
    enabled: boolean;
    onToggle: (enabled: boolean) => void;
    disabled: boolean;
    durationMinutes: number;
}

const BurnOnReadButton = ({enabled, onToggle, disabled, durationMinutes}: Props) => {
    const {formatMessage} = useIntl();

    const handleClick = () => {
        onToggle(!enabled);
    };

    const tooltipMessage = formatMessage(
        {
            id: 'burn_on_read.button.tooltip',
            defaultMessage: 'Burn-on-read: Message will be deleted for a recipient {duration} minutes after they open it',
        },
        {duration: durationMinutes},
    );

    return (
        <WithTooltip title={tooltipMessage}>
            <IconContainer
                id='burnOnReadButton'
                className={classNames({control: true, active: enabled})}
                disabled={disabled}
                type='button'
                aria-label={tooltipMessage}
                onClick={handleClick}
            >
                <FireIcon
                    size={18}
                    color='currentColor'
                />
            </IconContainer>
        </WithTooltip>
    );
};

export default memo(BurnOnReadButton);
