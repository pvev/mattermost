// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {FormattedMessage, useIntl} from 'react-intl';
import TemplateList from './template_intro_list';

import Wrench from 'components/common/svg_images_components/wrench_svg';

import {Channel} from '@mattermost/types/channels';

import {integrationIds, suitePluginIds} from 'utils/constants';

import './channel_from_template_intro_message.scss';

type ChannelFromTemplateIntroProps = {
    templateItems: {
        boards: Array<{name: string; id: string}>;
        playbooks: Array<{name: string; id: string}>;
        integrations: Array<{name: string; id: string; installed: boolean}>;
    };
    channel: Channel;
    channelInvite: JSX.Element;
    creatorName?: string;
    createdAt: JSX.Element;
    isPrivate: boolean;
};

export const ITEMS = Object.freeze({
    playbooks: suitePluginIds.playbooks,
    boards: suitePluginIds.boards,
    integrations: suitePluginIds.integrations,
});

export const INTEGRATIONS = Object.freeze({
    github: integrationIds.github,
    gitlab: integrationIds.gitlab,
    zoom: integrationIds.zoom,
    jira: integrationIds.jira,
    todo: integrationIds.todo,
});

export const ChannelFromTemplateIntro = ({
    templateItems,
    channel,
    channelInvite,
    creatorName,
    createdAt,
    isPrivate,
}: ChannelFromTemplateIntroProps) => {
    const {boards, playbooks, integrations} = templateItems;
    const {formatMessage} = useIntl();

    const publicOrPrivate = isPrivate ? formatMessage({id: 'channel_from_template.private', defaultMessage: 'Private'}) : formatMessage({id: 'channel_from_template.public', defaultMessage: 'Public'});
    const createdBy = creatorName ? `by ${creatorName} ` : '';

    const subtitleStart = formatMessage({
        id: 'channel_from_template.subtitleStart',
        defaultMessage: '{publicOrPrivate} channel created {createdBy} on {createdAt}. '}, {publicOrPrivate, createdBy, createdAt},
    );

    const subtitleEnd = formatMessage({
        id: 'channel_from_template.subtitleEnd',
        defaultMessage: '{channelInvite} to message, meet, and screen share within fully secure, searchable channels.'}, {channelInvite},
    );

    return (
        <div className='ChannelFromTemplateIntro'>
            <div className='ChannelFromTemplateIntro__header'>
                <div
                    className='ChannelFromTemplateIntro__header--image'
                >
                    <Wrench
                        width={44}
                        height={44}
                    />
                </div>
                <div className='ChannelFromTemplateIntro__header--text'>
                    <h2 className='ChannelFromTemplateIntro__header--textTitle'>
                        <FormattedMessage
                            id='channel_from_template.title'
                            defaultMessage='Welcome to your {channelName} channel'
                            values={{channelName: channel.name}}
                        />
                    </h2>
                    <p className='ChannelFromTemplateIntro__header--textSubtitle'>
                        <i className='icon icon-globe'/>
                        {subtitleStart}
                        {subtitleEnd}
                    </p>
                </div>
            </div>
            <div className='ChannelFromTemplateIntro__body'>
                <TemplateList
                    listItems={{type: ITEMS.boards, items: boards}}
                />
                <TemplateList
                    listItems={{type: ITEMS.playbooks, items: playbooks}}
                />
                <TemplateList
                    listItems={{type: ITEMS.integrations, items: integrations}}
                />
            </div>
        </div>
    );
};
