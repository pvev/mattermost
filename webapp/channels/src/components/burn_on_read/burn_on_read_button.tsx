// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {memo, useCallback, useState} from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import {useSelector} from 'react-redux';

import {FireIcon, PinOutlineIcon} from '@mattermost/compass-icons/components';
import {WithTooltip} from '@mattermost/shared/components/tooltip';

import {IconContainer} from 'components/advanced_text_editor/formatting_bar/formatting_icon';
import CompassDesignProvider from 'components/compass_design_provider';
import * as Menu from 'components/menu';
import Toggle from 'components/toggle';

import {getTheme} from 'mattermost-redux/selectors/entities/preferences';

type Props = {

    // Whether Burn-on-Read mode is currently enabled for the draft
    enabled: boolean;

    // Callback when the button is clicked to toggle BoR on/off
    onToggle: (enabled: boolean) => void;

    // Callback to toggle pin mode
    onSetPinned: (pinned: boolean) => void;

    // Whether pin mode is currently active
    pinned: boolean;

    // Whether the button should be disabled (e.g., in preview mode)
    disabled: boolean;

    // The configured duration in minutes for BoR messages
    durationMinutes: number;
}

const BurnOnReadButton = ({enabled, onToggle, onSetPinned, pinned, disabled, durationMinutes}: Props) => {
    const {formatMessage} = useIntl();
    const theme = useSelector(getTheme);
    const [pickerOpen, setPickerOpen] = useState(false);

    const tooltipTitle = pinned ? formatMessage({
        id: 'burn_on_read.button.tooltip.title.pinned',
        defaultMessage: 'Burn-on-read (Pinned)',
    }) : formatMessage({
        id: 'burn_on_read.button.tooltip.title',
        defaultMessage: 'Burn-on-read',
    });

    const tooltipHint = formatMessage(
        {
            id: 'burn_on_read.button.tooltip.hint',
            defaultMessage: 'Message will be deleted for a recipient {duration} minutes after they open it',
        },
        {duration: durationMinutes},
    );

    const handleIconClick = useCallback((e: React.MouseEvent) => {
        // Stop propagation so Menu.Container's own handleMenuButtonClick (which
        // always sets open=true) doesn't fire — we control isMenuOpen ourselves.
        e.stopPropagation();
        if (disabled) {
            return;
        }
        if (!enabled) {
            // OFF → immediately arm BoR + open popup for pin configuration
            onToggle(true);
            setPickerOpen(true);
        } else if (pinned) {
            // ON + pinned (active icon) → one-click kills both pin and BoR
            // onToggle(false) calls handleBurnOnReadApply(false) which clears
            // both type=BURN_ON_READ and burn_on_read_pinned metadata in one update
            onToggle(false);
            setPickerOpen(false);
        } else {
            // ON + not pinned → disarm BoR
            onToggle(false);
            setPickerOpen(false);
        }
    }, [disabled, enabled, pinned, onToggle]);

    const handlePinToggle = useCallback(() => {
        onSetPinned(!pinned);
    }, [pinned, onSetPinned]);

    return (
        <CompassDesignProvider theme={theme}>
            <Menu.Container
                menuButton={{
                    id: 'burnOnReadButton',
                    as: 'div',
                    children: (
                        <WithTooltip
                            title={tooltipTitle}
                            hint={tooltipHint}
                        >
                            <IconContainer
                                id='burnOnReadButtonIcon'
                                className={classNames({control: true, active: pinned})}
                                disabled={disabled}
                                type='button'
                                aria-label={`${tooltipTitle}: ${tooltipHint}`}
                                onClick={handleIconClick}
                            >
                                <FireIcon
                                    size={18}
                                    color='currentColor'
                                />
                            </IconContainer>
                        </WithTooltip>
                    ),
                }}
                menu={{
                    id: 'burn.on.read.dropdown',
                    'aria-label': formatMessage({
                        id: 'burn_on_read.button.options.menu',
                        defaultMessage: 'Burn-on-read options',
                    }),
                    width: 'max-content',
                    onToggle: setPickerOpen,
                    isMenuOpen: pickerOpen,
                    className: 'BurnOnReadButton__menu',
                }}
                menuHeader={
                    <div>
                        <div className='BurnOnReadButton__header'>
                            <FormattedMessage
                                id='burn_on_read.picker.header'
                                defaultMessage='Burn on Read'
                            />
                        </div>
                        <Menu.Separator/>
                    </div>
                }
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                closeMenuOnTab={false}
            >
                <Menu.Item
                    id='burnOnReadPinItem'
                    role='menuitemcheckbox'
                    aria-checked={pinned}
                    disableCloseOnSelect={true}
                    leadingElement={<PinOutlineIcon size={18} color='currentColor'/>}
                    labels={
                        <>
                            <div>
                                <FormattedMessage
                                    id='burn_on_read.picker.pin'
                                    defaultMessage='Pin for this conversation'
                                />
                            </div>
                            <div>
                                <FormattedMessage
                                    id='burn_on_read.picker.pin.hint'
                                    defaultMessage='Send all messages as Burn on Read'
                                />
                            </div>
                        </>
                    }
                    trailingElements={
                        <Toggle
                            id='burnOnReadPinToggle'
                            toggled={pinned}
                            onToggle={handlePinToggle}
                            size='btn-sm'
                            toggleClassName='btn-toggle-primary'
                            ariaLabel={formatMessage({
                                id: 'burn_on_read.picker.pin.toggle',
                                defaultMessage: 'Pin Burn on Read for this conversation',
                            })}
                        />
                    }
                    onClick={handlePinToggle}
                />
            </Menu.Container>
        </CompassDesignProvider>
    );
};

export default memo(BurnOnReadButton);
