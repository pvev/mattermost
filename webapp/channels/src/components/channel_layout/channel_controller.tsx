// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import classNames from 'classnames';
import React, {useEffect} from 'react';
import {useDispatch, useSelector} from 'react-redux';

import {getIsUserStatusesConfigEnabled} from 'mattermost-redux/selectors/entities/common';
import type {DispatchFunc} from 'mattermost-redux/types/actions';

import {loadStatusesForChannelAndSidebar} from 'actions/status_actions';

import CenterChannel from 'components/channel_layout/center_channel';
import FaviconTitleHandler from 'components/favicon_title_handler';
import LoadingScreen from 'components/loading_screen';
import ProductNoticesModal from 'components/product_notices_modal';
import ResetStatusModal from 'components/reset_status_modal';
import Sidebar from 'components/sidebar';

import Pluggable from 'plugins/pluggable';
import {Constants} from 'utils/constants';
import {isInternetExplorer, isEdge} from 'utils/user_agent';

const BODY_CLASS_FOR_CHANNEL = ['app__body', 'channel-view'];

type Props = {
    shouldRenderCenterChannel: boolean;
}

export default function ChannelController(props: Props) {
    const dispatch = useDispatch<DispatchFunc>();
    const enableUserStatuses = useSelector(getIsUserStatusesConfigEnabled);

    useEffect(() => {
        const isMsBrowser = isInternetExplorer() || isEdge();
        const {navigator} = window;
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const platform = navigator?.userAgentData?.platform || navigator?.platform || 'unknown';
        document.body.classList.add(...getClassnamesForBody(platform, isMsBrowser));

        return () => {
            document.body.classList.remove(...BODY_CLASS_FOR_CHANNEL);
        };
    }, []);

    useEffect(() => {
        if (enableUserStatuses) {
            const loadStatusesIntervalId = setInterval(() => {
                dispatch(loadStatusesForChannelAndSidebar());
            }, Constants.STATUS_INTERVAL);

            return () => {
                clearInterval(loadStatusesIntervalId);
            };
        }
        return () => {}; // Return a no-op function when enableUserStatuses is false
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enableUserStatuses]);

    return (
        <>
            <Sidebar/>
            <div
                id='channel_view'
                className='channel-view'
                data-testid='channel_view'
            >
                <FaviconTitleHandler/>
                <ProductNoticesModal/>
                <div className={classNames('container-fluid channel-view-inner')}>
                    {props.shouldRenderCenterChannel ? <CenterChannel/> : <LoadingScreen centered={true}/>}
                    <Pluggable pluggableName='Root'/>
                    <ResetStatusModal/>
                </div>
            </div>
        </>
    );
}

export function getClassnamesForBody(platform: Window['navigator']['platform'], isMsBrowser = false) {
    const bodyClass = [...BODY_CLASS_FOR_CHANNEL];

    // OS Detection
    if (platform === 'Win32' || platform === 'Win64') {
        bodyClass.push('os--windows');
    } else if (platform === 'MacIntel' || platform === 'MacPPC') {
        bodyClass.push('os--mac');
    }

    // IE Detection
    if (isMsBrowser) {
        bodyClass.push('browser--ie');
    }

    return bodyClass;
}
