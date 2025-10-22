import React from 'react';
import type {Preview} from '@storybook/react';
import {IntlProvider} from 'react-intl';
import {Provider} from 'react-redux';
import {Router} from 'react-router-dom';
import {createMemoryHistory} from 'history';
import {createStore} from 'redux';

import en from '../src/i18n/en.json';

// Import main Mattermost styles - this includes Bootstrap, Font Awesome, and all component styles
// The sass-loader is configured with proper includePaths to resolve @use statements
import '../src/sass/styles.scss';

// Import additional CSS variable overrides for Storybook if needed
import './storybook-styles.css';

// Simple mock reducer for Storybook
const mockReducer = (state = {}) => state;

// Create a minimal store for Storybook
const mockStore = createStore(mockReducer, {
    entities: {
        general: {
            config: {},
            license: {},
        },
        users: {
            currentUserId: '',
            profiles: {},
        },
        teams: {
            currentTeamId: '',
            teams: {},
        },
        channels: {
            currentChannelId: '',
            channels: {},
        },
        preferences: {
            myPreferences: {},
        },
    },
    views: {
        rhs: {
            selectedPostId: '',
        },
    },
});

const preview: Preview = {
    parameters: {
        actions: {argTypesRegex: '^on[A-Z].*'},
        controls: {
            matchers: {
                color: /(background|color)$/i,
                date: /Date$/i,
            },
        },
        backgrounds: {
            default: 'mattermost',
            values: [
                {
                    name: 'mattermost',
                    value: '#ffffff',
                },
                {
                    name: 'dark',
                    value: '#1e1e1e',
                },
            ],
        },
    },
    decorators: [
        (Story) => {
            const history = createMemoryHistory();
            return (
                <Provider store={mockStore}>
                    <IntlProvider
                        locale="en"
                        messages={en}
                        defaultLocale="en"
                    >
                        <Router history={history}>
                            <div className="app__body" style={{padding: '20px', minHeight: '100vh'}}>
                                <Story />
                            </div>
                        </Router>
                    </IntlProvider>
                </Provider>
            );
        },
    ],
};

export default preview;
