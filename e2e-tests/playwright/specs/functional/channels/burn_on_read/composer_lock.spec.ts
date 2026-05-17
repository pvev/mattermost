// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import {expect, test} from '@mattermost/playwright-lib';

import {BOR_TAG, setupBorTest, createSecondUser} from './support';

// The BoR pin popup is a MUI Menu (Menu.Container). Popup visibility is detected
// by the presence of the pin toggle button which only renders when the menu is open.
function getPinToggle(page: any) {
    return page.getByRole('button', {name: /Pin Burn on Read for this conversation/i});
}

test.describe('Burn-on-Read Composer Pin Mode', () => {
    test(
        'MM-66742_29 pin mode persists BoR state across consecutive sends',
        {tag: [BOR_TAG]},
        async ({pw}) => {
            // # Initialize setup with BoR enabled
            const {user: sender, team, adminClient} = await setupBorTest(pw);

            // # Create receiver and DM channel for a controlled environment
            const receiver = await createSecondUser(pw, adminClient, team);
            await adminClient.createDirectChannel([sender.id, receiver.id]);

            // # Login as sender and navigate to DM
            const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
            await senderPage.goto(team.name, `@${receiver.username}`);
            await senderPage.toBeVisible();

            const postCreate = senderPage.centerView.postCreate;

            // # Click BoR icon (OFF → immediately arm BoR + open popup)
            await postCreate.toggleBurnOnRead();

            // * Verify popup opened — pin toggle is visible inside the MUI Menu
            await expect(getPinToggle(senderPage.page)).toBeVisible();

            // * Verify BoR is already armed (label visible)
            await expect(postCreate.burnOnReadLabel).toBeVisible();

            // # Enable pin mode via toggle in popup
            await getPinToggle(senderPage.page).click();

            // * Verify pin toggle is active
            await expect(getPinToggle(senderPage.page)).toHaveAttribute('aria-pressed', 'true');

            // # Send first message (clicking the send button closes the MUI Menu)
            const message1 = `Pinned BoR first ${pw.random.id()}`;
            await senderPage.postMessage(message1);

            // * Verify first message was sent as BoR (has flame badge)
            const firstPost = await senderPage.getLastPost();
            await expect(firstPost.burnOnReadBadge.container).toBeVisible();

            // * Verify BoR label is still visible after send — pin keeps BoR active for next message
            await expect(postCreate.burnOnReadLabel).toBeVisible({timeout: 5000});

            // # Send second message without re-enabling BoR (pin persistence)
            const message2 = `Pinned BoR second ${pw.random.id()}`;
            await senderPage.postMessage(message2);

            // * Verify second message was also sent as BoR
            const secondPost = await senderPage.getLastPost();
            await expect(secondPost.burnOnReadBadge.container).toBeVisible();

            // * Verify BoR label is still showing (pin not removed)
            await expect(postCreate.burnOnReadLabel).toBeVisible({timeout: 5000});
        },
    );

    test(
        'MM-66742_30 icon click when BoR is pinned immediately disarms both pin and BoR',
        {tag: [BOR_TAG]},
        async ({pw}) => {
            // # Initialize setup with BoR enabled
            const {user: sender, team, adminClient} = await setupBorTest(pw);

            // # Create receiver and DM channel
            const receiver = await createSecondUser(pw, adminClient, team);
            await adminClient.createDirectChannel([sender.id, receiver.id]);

            // # Login as sender and navigate to DM
            const {channelsPage: senderPage} = await pw.testBrowser.login(sender);
            await senderPage.goto(team.name, `@${receiver.username}`);
            await senderPage.toBeVisible();

            const postCreate = senderPage.centerView.postCreate;

            // # Click BoR icon (OFF → arm BoR + open popup)
            await postCreate.toggleBurnOnRead();
            await expect(getPinToggle(senderPage.page)).toBeVisible();

            // # Enable pin mode
            await getPinToggle(senderPage.page).click();
            await expect(getPinToggle(senderPage.page)).toHaveAttribute('aria-pressed', 'true');

            // # Dismiss popup by pressing Escape
            await senderPage.page.keyboard.press('Escape');
            await expect(getPinToggle(senderPage.page)).not.toBeVisible();

            // * Verify BoR is still armed after closing popup
            await expect(postCreate.burnOnReadLabel).toBeVisible();

            // * Verify the icon is in active state because BoR is pinned
            await expect(postCreate.burnOnReadButton).toHaveClass(/active/);

            // # Click BoR icon again (ON + pinned → one-click immediately disarms both pin and BoR)
            await postCreate.burnOnReadButton.click();

            // * Verify popup did NOT open — pin toggle is not visible
            await expect(getPinToggle(senderPage.page)).not.toBeVisible();

            // * Verify BoR label is gone — BoR was fully disarmed
            await expect(postCreate.burnOnReadLabel).not.toBeVisible();

            // * Verify the icon is no longer in active state
            await expect(postCreate.burnOnReadButton).not.toHaveClass(/active/);
        },
    );
});
