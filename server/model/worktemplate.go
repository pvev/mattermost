// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
)

const (
	// used to assign the work template id to newly created channels
	WorkTemplateIDChannelProp = "work_template_id"

	// Visibility
	WorkTemplateVisibilityPublic  = "public"
	WorkTemplateVisibilityPrivate = "private"
)

type WorkTemplateCategory struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type WorkTemplate struct {
	ID           string                   `json:"id"`
	Category     string                   `json:"category"`
	UseCase      string                   `json:"useCase"`
	Illustration string                   `json:"illustration"`
	Visibility   string                   `json:"visibility"`
	FeatureFlag  *WorkTemplateFeatureFlag `json:"featureFlag,omitempty"`
	Description  Description              `json:"description"`
	Content      []WorkTemplateContent    `json:"content"`
}

type WorkTemplateFeatureFlag struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type DescriptionContent struct {
	Message      string `json:"message"`
	Illustration string `json:"illustration"`
}

type Description struct {
	Channel     *DescriptionContent `json:"channel"`
	Board       *DescriptionContent `json:"board"`
	Playbook    *DescriptionContent `json:"playbook"`
	Integration *DescriptionContent `json:"integration"`
}

type WorkTemplateChannel struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Purpose      string `json:"purpose"`
	Playbook     string `json:"playbook"`
	Illustration string `json:"illustration"`
}

type WorkTemplateBoard struct {
	ID           string `json:"id"`
	Template     string `json:"template"`
	Name         string `json:"name"`
	Channel      string `json:"channel"`
	Illustration string `json:"illustration"`
}

type WorkTemplatePlaybook struct {
	Template     string `json:"template"`
	Name         string `json:"name"`
	ID           string `json:"id"`
	Illustration string `json:"illustration"`
}

type WorkTemplateIntegration struct {
	ID          string `json:"id"`
	Recommended bool   `json:"recommended"`
}

type WorkTemplateContent struct {
	Channel     *WorkTemplateChannel     `json:"channel,omitempty"`
	Board       *WorkTemplateBoard       `json:"board,omitempty"`
	Playbook    *WorkTemplatePlaybook    `json:"playbook,omitempty"`
	Integration *WorkTemplateIntegration `json:"integration,omitempty"`
}

type WorkTemplateExecutionResult struct {
	ChannelWithPlaybookIDs []string `json:"channel_with_playbook_ids"`
	ChannelIDs             []string `json:"channel_ids"`
}

// TODO: store more information about each item, like for plugins, the state or whatever
type WorkTemplateResult struct {
	Playbooks    []string `json:"playbooks,omitempty"`
	Boards       []string `json:"boards,omitempty"`
	Integrations []string `json:"integrations,omitempty"`
}

func (m *WorkTemplateResult) Scan(value any) error {
	if value == nil {
		return nil
	}

	buf, ok := value.([]byte)
	if ok {
		return json.Unmarshal(buf, m)
	}

	str, ok := value.(string)
	if ok {
		return json.Unmarshal([]byte(str), m)
	}

	return errors.New("received value is neither a byte slice nor string")
}

// Value converts StringInterface to database value
func (si *WorkTemplateResult) Value() (driver.Value, error) {
	j, err := json.Marshal(si)
	if err != nil {
		return nil, err
	}

	if len(j) > maxPropSizeBytes {
		return nil, ErrMaxPropSizeExceeded
	}

	// non utf8 characters are not supported https://mattermost.atlassian.net/browse/MM-41066
	return string(j), err
}
