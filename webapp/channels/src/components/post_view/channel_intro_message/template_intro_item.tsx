// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {ITEMS} from './channel_from_template_intro_message';

import './template_intro_item.scss';

type SvgProps = {
    width: number;
    height: number;
}
interface Props {
    svgImage: (props: SvgProps) => JSX.Element;
    title: string;
    itemType: string;
    integrationInstalled?: boolean | undefined;
}

const TemplateItem = ({svgImage, title, itemType, integrationInstalled}: Props) => {
    const {formatMessage} = useIntl();

    if (!Object.values(ITEMS).includes(itemType)) {
        return null;
    }

    const isIntegration = itemType === ITEMS.integrations;

    return (
        <div className='TemplateItem'>
            <div className='TemplateItem__image'>
                <picture>
                    {React.createElement(svgImage, {width: 18, height: 18})}
                </picture>
            </div>
            <div className='TemplateItem__title'>{title}</div>
            {isIntegration && (
                <button
                    className='TemplateItem__button'
                >
                    {integrationInstalled ? formatMessage({id: 'channel_from_template.items.configure', defaultMessage: 'Configure'}) : formatMessage({id: 'channel_from_template.items.install', defaultMessage: 'Install'})}
                </button>
            )}
        </div>
    );
};

export default TemplateItem;
