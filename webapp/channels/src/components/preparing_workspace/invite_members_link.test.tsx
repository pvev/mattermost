// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react';
import {trackEvent} from 'actions/telemetry_actions';
import InviteMembersLink from './invite_members_link';
import {withIntl} from 'tests/helpers/intl-test-helper';

jest.mock('actions/telemetry_actions', () => ({
    trackEvent: jest.fn(),
}));

describe('components/preparing-workspace/invite_members_link', () => {
    const inviteURL = 'https://invite-url.mattermost.com';

    it('should match snapshot', () => {
        const component = withIntl(<InviteMembersLink inviteURL={inviteURL}/>);

        const {container} = render(component);
        expect(container).toMatchSnapshot();
    });

    it('renders an input field with the invite URL', () => {
        const component = withIntl(<InviteMembersLink inviteURL={inviteURL}/>);
        render(component);
        const input = screen.getByDisplayValue(inviteURL);
        expect(input).toBeInTheDocument();
    });

    it('renders a button to copy the invite URL', () => {
        const component = withIntl(<InviteMembersLink inviteURL={inviteURL}/>);
        render(component);
        const button = screen.getByRole('button', {name: /copy link/i});
        expect(button).toBeInTheDocument();
    });

    it('calls the trackEvent function when the copy button is clicked', () => {
        const component = withIntl(<InviteMembersLink inviteURL={inviteURL}/>);
        render(component);
        const button = screen.getByRole('button', {name: /copy link/i});
        fireEvent.click(button);
        expect(trackEvent).toHaveBeenCalledWith(
            'first_admin_setup',
            'admin_setup_click_copy_invite_link',
        );
    });

    it('changes the button text to "Link Copied" when the URL is copied', () => {
        const component = withIntl(<InviteMembersLink inviteURL={inviteURL}/>);
        render(component);
        const button = screen.getByRole('button', {name: /copy link/i});
        const originalText = 'Copy Link';
        const linkCopiedText = 'Link Copied';
        expect(button).toHaveTextContent(originalText);

        fireEvent.click(button);

        expect(button).toHaveTextContent(linkCopiedText);
    });
});
