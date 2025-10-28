// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';

import Tag from './tag';
import type {TagSize} from './tag';

type Props = {
    className?: string;
    size?: TagSize;
};

const GuestTag = ({className = '', size = 'xs'}: Props) => {
    return (
        <Tag
            preset='guest'
            size={size}
            className={className}
        />
    );
};

export default GuestTag;
