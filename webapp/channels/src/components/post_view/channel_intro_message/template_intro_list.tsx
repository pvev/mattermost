// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {useIntl} from 'react-intl';

import {WTRData} from '@mattermost/types/channels';

import GithubSVG from 'components/common/svg_images_components/github_svg';
import GitlabSVG from 'components/common/svg_images_components/gitlab_svg';
import JiraSVG from 'components/common/svg_images_components/jira_svg';
import ZoomSVG from 'components/common/svg_images_components/zoom_svg';
import TodoSVG from 'components/common/svg_images_components/todo_svg';
import BoardsSVG from 'components/common/svg_images_components/boards_svg';
import PlaybooksSVG from 'components/common/svg_images_components/playbooks_svg';

import {integrationsMap} from 'utils/constants';

import TemplateItem from './template_intro_item';
import {ITEMS} from './channel_from_template_intro_message';
import './template_intro_list.scss';

interface Props {
    listItems: {
        type: string;
        items: WTRData[];
    };
}

const TemplateList = ({listItems}: Props) => {
    const {type, items} = listItems;
    const {formatMessage} = useIntl();

    if (!Object.values(ITEMS).includes(type)) {
        return null;
    }

    type SvgProps = {
        width: number;
        height: number;
    }

    type ListData = {
        listIcon: string;
        image: (props: SvgProps) => JSX.Element;
        title: string;
        description: string;
    }

    const itemTypeToData: Record<string, ListData> = {
        [ITEMS.playbooks]: {listIcon: 'icon-product-playbooks', image: PlaybooksSVG, title: formatMessage({id: 'channel_from_template.items_list.titlePlaybooks', defaultMessage: 'Checklists'}), description: formatMessage({id: 'channel_from_template.items_list.descriptionPlaybooks', defaultMessage: 'Move quicker and make fewer mistakes with checklist-based automations.'})},
        [ITEMS.boards]: {listIcon: 'icon-product-boards', image: BoardsSVG, title: formatMessage({id: 'channel_from_template.items_list.titleBoards', defaultMessage: 'Boards'}), description: formatMessage({id: 'channel_from_template.items_list.descriptionBoards', defaultMessage: 'Keep your project organized and on-track with kanban-style boards.'})},
        [ITEMS.integrations]: {listIcon: 'icon-lightning-bolt-outline', image: GithubSVG, title: formatMessage({id: 'channel_from_template.items_list.titleIntegrations', defaultMessage: 'Integrations'}), description: formatMessage({id: 'channel_from_template.items_list.descriptionIntegrations', defaultMessage: 'Expand the power of Mattermost by connecting tools you use outside.'})},
    };

    const integrationImageMap: Record<string, (props: SvgProps) => JSX.Element> = {
        [integrationsMap.github.id]: GithubSVG,
        [integrationsMap.gitlab.id]: GitlabSVG,
        [integrationsMap.zoom.id]: ZoomSVG,
        [integrationsMap.todo.id]: TodoSVG,
        [integrationsMap.jira.id]: JiraSVG,
    };

    const {image, title, description, listIcon} = itemTypeToData[listItems.type];

    return (
        <div className={'TemplateList'}>
            <header className={'TemplateList__Header'}>
                <div className={'TemplateList__Header--image'}>
                    <i className={`icon ${listIcon}`}/>
                </div>
                <div className={'TemplateList__Header--title'}>
                    {title}
                </div>
            </header>
            <div className={'TemplateList__Description'}>
                {description}
            </div>
            <div className={'TemplateList__Items'}>
                {items.map((item, index) => (
                    <div key={`${item.id}${index.toString}`}>
                        <TemplateItem
                            svgImage={type === ITEMS.integrations ? integrationImageMap[item.id] : image}
                            title={item.name}
                            itemType={type}
                            installedVersion={item.installedVersion}
                            redirectLink={item.link}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TemplateList;
