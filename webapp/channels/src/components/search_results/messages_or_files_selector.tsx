// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {useRef} from 'react';
import {FormattedMessage} from 'react-intl';
import {useSelector} from 'react-redux';

import {getMyTeams} from 'mattermost-redux/selectors/entities/teams';

import {getSearchTeam} from 'selectors/rhs';

import type {SearchFilterType} from 'components/search/types';

import type {A11yFocusEventDetail} from 'utils/constants';
import Constants, {A11yCustomEventTypes} from 'utils/constants';
import * as Keyboard from 'utils/keyboard';

import type {GlobalState} from 'types/store';
import type {SearchType} from 'types/store/rhs';

import FilesFilterMenu from './files_filter_menu';

const {KeyCodes} = Constants;

import './messages_or_files_selector.scss';

type Props = {
    selected: string;
    selectedFilter: SearchFilterType;
    messagesCounter: string;
    filesCounter: string;
    isFileAttachmentsEnabled: boolean;
    crossTeamSearchEnabled: boolean;
    onChange: (value: SearchType) => void;
    onFilter: (filter: SearchFilterType) => void;
    onTeamChange: (teamId: string) => void;
};

export default function MessagesOrFilesSelector(props: Props): JSX.Element {
    const teams = useSelector((state: GlobalState) => getMyTeams(state));
    const searchTeam = useSelector((state: GlobalState) => getSearchTeam(state));

    // REFS to the tabs so there is ability to pass the custom A11y focus event
    const messagesTabRef = useRef<HTMLButtonElement>(null);
    const filesTabRef = useRef<HTMLButtonElement>(null);

    const options = [{value: '', label: 'All teams', selected: searchTeam === ''}];
    for (const team of teams) {
        options.push({value: team.id, label: team.display_name, selected: searchTeam === team.id});
    }

    const onTeamChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        props.onTeamChange(e.target.value);
    };

    // Enhanced arrow key handling to focus the new select tab and also send the a11y custom event
    const handleTabKeyDown = (
        e: React.KeyboardEvent<HTMLButtonElement>,
        currentTab: 'messages' | 'files',
    ) => {
        if (Keyboard.isKeyPressed(e, KeyCodes.LEFT) || Keyboard.isKeyPressed(e, KeyCodes.RIGHT)) {
            e.preventDefault();
            e.stopPropagation();
            let nextTab: SearchType;
            let nextTabRef: React.RefObject<HTMLButtonElement>;

            if (currentTab === 'messages' && props.isFileAttachmentsEnabled) {
                nextTab = 'files';
                nextTabRef = filesTabRef;
            } else {
                nextTab = 'messages';
                nextTabRef = messagesTabRef;
            }

            props.onChange(nextTab);

            // Dispatch the custom a11y focus event to focus the selected tab
            if (nextTabRef.current) {
                setTimeout(() => {
                    document.dispatchEvent(
                        new CustomEvent<A11yFocusEventDetail>(A11yCustomEventTypes.FOCUS, {
                            detail: {
                                target: nextTabRef.current,
                                keyboardOnly: true,
                            },
                        }),
                    );
                }, 0);
            }
            return;
        }

        if (Keyboard.isKeyPressed(e, KeyCodes.ENTER)) {
            props.onChange(currentTab);
        }
    };

    return (
        <div className='MessagesOrFilesSelector'>
            <div
                className='buttons-container'
                role='tablist'
                aria-label='Messages or Files'
            >
                <button
                    ref={messagesTabRef}
                    role='tab'
                    aria-selected={props.selected === 'messages' ? 'true' : 'false'}
                    tabIndex={props.selected === 'messages' ? 0 : -1}
                    aria-controls='searchMessagesPanel'
                    id='messagesTab'
                    onClick={() => props.onChange('messages')}
                    onKeyDown={(e) => handleTabKeyDown(e, 'messages')}
                    className={props.selected === 'messages' ? 'active tab messages-tab' : 'tab messages-tab'}
                >
                    <FormattedMessage
                        id='search_bar.messages_tab'
                        defaultMessage='Messages'
                    />
                    <span className='counter'>{props.messagesCounter}</span>
                </button>
                {props.isFileAttachmentsEnabled && (
                    <button
                        ref={filesTabRef}
                        role='tab'
                        aria-selected={props.selected === 'files' ? 'true' : 'false'}
                        tabIndex={props.selected === 'files' ? 0 : -1}
                        aria-controls='searchFilesPanel'
                        id='filesTab'
                        onClick={() => props.onChange('files')}
                        onKeyDown={(e) => handleTabKeyDown(e, 'files')}
                        className={props.selected === 'files' ? 'active tab files-tab' : 'tab files-tab'}
                    >
                        <FormattedMessage
                            id='search_bar.files_tab'
                            defaultMessage='Files'
                        />
                        <span className='counter'>{props.filesCounter}</span>
                    </button>
                )}
            </div>
            {props.crossTeamSearchEnabled && (
                <div className='team-selector-container'>
                    <select
                        value={searchTeam}
                        onChange={onTeamChange}
                    >
                        {options.map((option) => (
                            <option
                                key={option.value}
                                value={option.value}
                            >
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>
            )}
            {props.selected === 'files' && (
                <FilesFilterMenu
                    selectedFilter={props.selectedFilter}
                    onFilter={props.onFilter}
                />
            )}
        </div>
    );
}
