// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import LoadingWrapper from 'components/widgets/loading/loading_wrapper';
import React from 'react';
import {FormattedMessage} from 'react-intl';
import {useDispatch, useSelector} from 'react-redux';

import {Link} from 'react-router-dom';

import {trackEvent} from 'actions/telemetry_actions';
import {installPlugin} from 'actions/marketplace';
import {closeModal} from 'actions/views/modals';

import {GlobalState} from 'types/store';

import {getConfig} from 'mattermost-redux/selectors/entities/general';
import {DispatchFunc} from 'mattermost-redux/types/actions';

import {getInstalling, getError} from 'selectors/views/marketplace';

import {localizeMessage} from 'utils/utils';
import {ModalIdentifiers} from 'utils/constants';

type Props = {
    pluginId: string;
    installedVersion?: string;
    extraClass?: string;
}

export const MarketPlaceItemButton = ({pluginId, installedVersion, extraClass}: Props): JSX.Element => {
    const dispatch = useDispatch<DispatchFunc>();

    const installing = useSelector((state: GlobalState) => getInstalling(state, pluginId));
    const error = useSelector((state: GlobalState) => getError(state, pluginId));
    const isDefaultMarketplace = useSelector((state: GlobalState) => getConfig(state).IsDefaultMarketplace === 'true');

    const closeMarketplaceModal = () => {
        dispatch(closeModal(ModalIdentifiers.PLUGIN_MARKETPLACE));
    };

    const trackMarketPlaceEvent = (
        eventName: string,
        allowDetail = true,
        version: string,
    ): void => {
        if (isDefaultMarketplace && allowDetail) {
            trackEvent('plugins', eventName, {
                plugin_id: pluginId,
                version,
                installed_version: installedVersion,
            });
        } else {
            trackEvent('plugins', eventName);
        }
    };

    const onInstall = (): void => {
        trackMarketPlaceEvent('ui_marketplace_download', true, '1');
        installPlugin(pluginId);
    };

    const onConfigure = (): void => {
        trackMarketPlaceEvent('ui_marketplace_configure', false, '2');
        closeMarketplaceModal();
    };

    if (installedVersion && installedVersion !== '' && !installing && !error) {
        return (
            <Link
                to={'/admin_console/plugins/plugin_' + pluginId}
            >
                <button
                    onClick={onConfigure}
                    className={`plugin-configure ${extraClass}`}
                >
                    <FormattedMessage
                        id='marketplace_modal.list.configure'
                        defaultMessage='Configure'
                    />
                </button>
            </Link>
        );
    }

    let actionButton: JSX.Element;
    if (error) {
        actionButton = (
            <FormattedMessage
                id='marketplace_modal.list.try_again'
                defaultMessage='Try Again'
            />
        );
    } else {
        actionButton = (
            <FormattedMessage
                id='marketplace_modal.list.install'
                defaultMessage='Install'
            />
        );
    }

    return (
        <button
            onClick={onInstall}
            className={`plugin-install always-show-enabled ${extraClass}`}
            disabled={installing}
        >
            <LoadingWrapper
                loading={installing}
                text={localizeMessage('marketplace_modal.installing', 'Installing...')}
            >
                {actionButton}
            </LoadingWrapper>

        </button>
    );
};
