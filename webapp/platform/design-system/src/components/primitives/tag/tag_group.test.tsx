// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen} from '@testing-library/react';

import Tag from './tag';
import TagGroup from './tag_group';

describe('TagGroup', () => {
    it('should render children', () => {
        render(
            <TagGroup>
                <Tag text="Tag 1" testId="tag-1"/>
                <Tag text="Tag 2" testId="tag-2"/>
            </TagGroup>,
        );
        expect(screen.getByTestId('tag-1')).toBeInTheDocument();
        expect(screen.getByTestId('tag-2')).toBeInTheDocument();
    });

    it('should apply base TagGroup class', () => {
        const {container} = render(
            <TagGroup>
                <Tag text="Test"/>
            </TagGroup>,
        );
        const group = container.firstChild as HTMLElement;
        expect(group).toHaveClass('TagGroup');
    });

    it('should apply custom className', () => {
        const {container} = render(
            <TagGroup className="custom-group">
                <Tag text="Test"/>
            </TagGroup>,
        );
        const group = container.firstChild as HTMLElement;
        expect(group).toHaveClass('TagGroup');
        expect(group).toHaveClass('custom-group');
    });

    it('should apply testId attribute', () => {
        render(
            <TagGroup testId="my-tag-group">
                <Tag text="Test"/>
            </TagGroup>,
        );
        expect(screen.getByTestId('my-tag-group')).toBeInTheDocument();
    });

    it('should render multiple tags', () => {
        render(
            <TagGroup>
                <Tag preset="beta"/>
                <Tag preset="bot"/>
                <Tag preset="guest"/>
                <Tag text="Custom" variant="info"/>
            </TagGroup>,
        );
        expect(screen.getByText('BETA')).toBeInTheDocument();
        expect(screen.getByText('BOT')).toBeInTheDocument();
        expect(screen.getByText('GUEST')).toBeInTheDocument();
        expect(screen.getByText('Custom')).toBeInTheDocument();
    });

    it('should handle empty children', () => {
        const {container} = render(<TagGroup/>);
        expect(container.firstChild).toBeInTheDocument();
    });

    it('should render as div element', () => {
        const {container} = render(
            <TagGroup>
                <Tag text="Test"/>
            </TagGroup>,
        );
        expect(container.firstChild?.nodeName).toBe('DIV');
    });
});

