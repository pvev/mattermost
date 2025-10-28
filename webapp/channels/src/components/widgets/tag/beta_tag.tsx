// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Tag from './tag';
import type {TagSize, TagVariant} from './tag';

type Props = {
    className?: string;
    size?: TagSize;
    variant?: TagVariant;
}

const BetaTag = ({className = '', size = 'xs', variant}: Props) => {
    return (
        <Tag
            preset='beta'
            size={size}
            variant={variant}
            className={className}
        />
    );
};

export default BetaTag;
