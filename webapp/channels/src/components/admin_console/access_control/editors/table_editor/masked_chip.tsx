// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import WithTooltip from 'components/with_tooltip';

import './selector_menus.scss';

/**
 * MaskedChip renders a single opaque chip indicating that hidden attribute values
 * exist in this condition. It uses a fixed 8-character token regardless of the
 * actual number or length of hidden values, preventing count-based and length-based
 * inference. The chip is non-interactive and accessible.
 */
const MaskedChip = (): JSX.Element => {
    const {formatMessage} = useIntl();

    const tooltipText = formatMessage({
        id: 'admin.access_control.masked_chip.tooltip',
        defaultMessage: 'One or more restricted values',
    });

    const ariaLabel = formatMessage({
        id: 'admin.access_control.masked_chip.aria_label',
        defaultMessage: 'Hidden values that you do not have permission to view',
    });

    return (
        <WithTooltip title={tooltipText}>
            <div
                className='select__multi-value select__multi-value--masked'
                role='img'
                aria-label={ariaLabel}
            >
                <div className='select__multi-value__label'>
                    {'••••••••'}
                </div>
            </div>
        </WithTooltip>
    );
};

export default MaskedChip;
