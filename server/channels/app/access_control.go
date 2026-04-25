// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const attributeViewRefreshInterval = 30 * time.Second

func (a *App) GetChannelsForPolicy(rctx request.CTX, policyID string, cursor model.AccessControlPolicyCursor, limit int) ([]*model.ChannelWithTeamData, int64, *model.AppError) {
	policy, appErr := a.GetAccessControlPolicy(rctx, policyID)
	if appErr != nil {
		return nil, 0, appErr
	}

	switch policy.Type {
	case model.AccessControlPolicyTypeParent:
		policies, total, err := a.Srv().Store().AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{
			Type:     model.AccessControlPolicyTypeChannel,
			ParentID: policyID,
			Cursor:   cursor,
			Limit:    limit,
		})
		if err != nil {
			return nil, 0, model.NewAppError("GetChannelsForPolicy", "app.pap.get_all_access_control_policies.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
		channelIDs := make([]string, 0, len(policies))

		// channel IDs are the same as policy IDs
		for _, p := range policies {
			channelIDs = append(channelIDs, p.ID)
		}

		chs, err := a.Srv().Store().Channel().GetChannelsWithTeamDataByIds(channelIDs, true)
		if err != nil {
			return nil, 0, model.NewAppError("GetChannelsForPolicy", "app.pap.get_all_access_control_policies.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		return chs, total, nil
	case model.AccessControlPolicyTypeChannel:
		chs, err := a.Srv().Store().Channel().GetChannelsWithTeamDataByIds([]string{policyID}, true)
		if err != nil {
			return nil, 0, model.NewAppError("GetChannelsForPolicy", "app.pap.get_all_access_control_policies.app_error", nil, err.Error(), http.StatusInternalServerError)
		}

		total := int64(len(chs))
		return chs, total, nil
	default:
		return nil, 0, model.NewAppError("GetChannelsForPolicy", "app.pap.get_all_access_control_policies.app_error", nil, "Invalid policy type", http.StatusBadRequest)
	}
}

func (a *App) GetAccessControlPolicy(rctx request.CTX, id string) (*model.AccessControlPolicy, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, model.NewAppError("GetPolicy", "app.pap.get_policy.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	policy, appErr := acs.GetPolicy(rctx, id)
	if appErr != nil {
		return nil, appErr
	}

	return policy, nil
}

func (a *App) CreateOrUpdateAccessControlPolicy(rctx request.CTX, policy *model.AccessControlPolicy) (*model.AccessControlPolicy, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, model.NewAppError("CreateAccessControlPolicy", "app.pap.create_access_control_policy.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	if policy.ID == "" {
		policy.ID = model.NewId()
	}

	policy.Version = model.AccessControlPolicyVersionV0_3
	for i, rule := range policy.Rules {
		for j, action := range rule.Actions {
			if action == "*" {
				policy.Rules[i].Actions[j] = model.AccessControlPolicyActionMembership
			}
		}
	}

	// Attribute-value masking write-path checks for delegated admins.
	// Attribute-value masking write-path checks for delegated admins.
	// When the feature flag is ON and the caller is not a system admin,
	// execute: validate → merge → self-inclusion check.
	if a.Config().FeatureFlags.AttributeBasedAccessControl && a.Config().FeatureFlags.AttributeValueMasking {
		session := rctx.Session()
		if session == nil {
			return nil, model.NewAppError("CreateOrUpdateAccessControlPolicy", "api.context.session_expired.app_error", nil, "session required for masking validation", http.StatusUnauthorized)
		}
		callerID := session.UserId
		isSystemAdmin := a.SessionHasPermissionTo(*session, model.PermissionManageSystem)

		if !isSystemAdmin {
			// Step 1: Validate submitted literal values BEFORE merging.
			// At this point the expression only contains the caller's visible values.
			// Validating after merge would reject the hidden values that were re-injected.
			if appErr := a.validatePolicyExpressionValues(rctx, policy, callerID); appErr != nil {
				return nil, appErr
			}

			// Step 2: Merge hidden values back from the stored policy.
			// The delegated admin's submitted expression only contains visible values;
			// hidden values from the stored policy are now re-injected.
			if appErr := a.mergeStoredPolicyExpressions(rctx, policy, callerID); appErr != nil {
				return nil, appErr
			}

			// Step 3: Self-inclusion check on the complete merged expression.
			// The caller must still satisfy the policy after their edit.
			if appErr := a.checkSelfInclusion(rctx, policy, callerID); appErr != nil {
				return nil, appErr
			}
		}
	}

	var appErr *model.AppError
	policy, appErr = acs.SavePolicy(rctx, policy)
	if appErr != nil {
		return nil, appErr
	}

	return policy, nil
}

// mergeStoredPolicyExpressions loads the existing stored policy (if updating) and merges
// hidden values back into the submitted expressions. For new policies (no stored version),
// this is a no-op.
func (a *App) mergeStoredPolicyExpressions(rctx request.CTX, policy *model.AccessControlPolicy, callerID string) *model.AppError {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return model.NewAppError("mergeStoredPolicyExpressions", "app.pap.merge_stored_policy.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	// Try to load the existing stored policy
	existingPolicy, appErr := acs.GetPolicy(rctx, policy.ID)
	if appErr != nil {
		// If the policy doesn't exist yet (new policy), no merge needed
		if appErr.StatusCode == http.StatusNotFound {
			return nil
		}
		return appErr
	}

	// Merge each rule's expression with the corresponding stored rule
	for i, rule := range policy.Rules {
		if i >= len(existingPolicy.Rules) {
			// New rule added by the admin — no stored expression to merge with
			continue
		}

		storedExpr := existingPolicy.Rules[i].Expression
		if storedExpr == "" || storedExpr == "true" {
			continue
		}

		mergedExpr, appErr := a.mergeExpressionWithMaskedValues(rctx, rule.Expression, storedExpr, callerID)
		if appErr != nil {
			return appErr
		}
		policy.Rules[i].Expression = mergedExpr
	}

	return nil
}

// checkSelfInclusion verifies that the caller still satisfies all rules in the policy.
// This evaluates the complete merged expression (including hidden values the admin didn't modify).
func (a *App) checkSelfInclusion(rctx request.CTX, policy *model.AccessControlPolicy, callerID string) *model.AppError {
	for _, rule := range policy.Rules {
		if rule.Expression == "" || rule.Expression == "true" {
			continue
		}

		matches, appErr := a.ValidateExpressionAgainstRequester(rctx, rule.Expression, callerID)
		if appErr != nil {
			return appErr
		}
		if !matches {
			return model.NewAppError("CreateOrUpdateAccessControlPolicy",
				"app.pap.save_policy.self_exclusion", nil,
				"You do not satisfy one or more conditions in this policy.", http.StatusBadRequest)
		}
	}

	return nil
}

func (a *App) DeleteAccessControlPolicy(rctx request.CTX, id string) *model.AppError {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return model.NewAppError("DeleteAccessControlPolicy", "app.pap.delete_access_control_policy.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	appErr := acs.DeletePolicy(rctx, id)
	if appErr != nil {
		return appErr
	}

	return nil
}

func (a *App) CheckExpression(rctx request.CTX, expression string) ([]model.CELExpressionError, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, model.NewAppError("CheckExpression", "app.pap.check_expression.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	errs, appErr := acs.CheckExpression(rctx, expression)
	if appErr != nil {
		return nil, model.NewAppError("CheckExpression", "app.pap.check_expression.app_error", nil, appErr.Error(), http.StatusInternalServerError)
	}

	return errs, nil
}

func (a *App) TestExpression(rctx request.CTX, expression string, opts model.SubjectSearchOptions) ([]*model.User, int64, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, 0, model.NewAppError("TestExpression", "app.pap.check_expression.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	res, count, err := acs.QueryUsersForExpression(rctx, expression, opts)
	if err != nil {
		return nil, 0, model.NewAppError("TestExpression", "app.pap.check_expression.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return res, count, nil
}

func (a *App) AssignAccessControlPolicyToChannels(rctx request.CTX, parentID string, channelIDs []string) ([]*model.AccessControlPolicy, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, model.NewAppError("AssignAccessControlPolicyToChannels", "app.pap.assign_access_control_policy_to_channels.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	policy, appErr := a.GetAccessControlPolicy(rctx, parentID)
	if appErr != nil {
		return nil, appErr
	}

	if policy.Type != model.AccessControlPolicyTypeParent {
		return nil, model.NewAppError("AssignAccessControlPolicyToChannels", "app.pap.assign_access_control_policy_to_channels.app_error", nil, "Policy is not of type parent", http.StatusBadRequest)
	}

	channels, err := a.GetChannels(rctx, channelIDs)
	if err != nil {
		return nil, err
	}

	policies := make([]*model.AccessControlPolicy, 0, len(channelIDs))
	for _, channel := range channels {
		if appErr := ValidateChannelEligibilityForAccessControl(channel); appErr != nil {
			return nil, appErr
		}

		child, err := acs.GetPolicy(rctx, channel.Id)
		if err != nil && err.StatusCode != http.StatusNotFound {
			return nil, model.NewAppError("AssignAccessControlPolicyToChannels", "app.pap.assign_access_control_policy_to_channels.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
		if child == nil {
			child = &model.AccessControlPolicy{
				ID:       channel.Id,
				Type:     model.AccessControlPolicyTypeChannel,
				Active:   policy.Active,
				CreateAt: model.GetMillis(),
				Props:    map[string]any{},
			}
		}
		child.Version = model.AccessControlPolicyVersionV0_3

		appErr := child.Inherit(policy)
		if appErr != nil {
			return nil, appErr
		}

		child, appErr = acs.SavePolicy(rctx, child)
		if appErr != nil {
			return nil, appErr
		}
		policies = append(policies, child)
	}

	return policies, nil
}

func (a *App) UnassignPoliciesFromChannels(rctx request.CTX, policyID string, channelIDs []string) *model.AppError {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return model.NewAppError("UnassignPoliciesFromChannels", "app.pap.unassign_access_control_policy_from_channels.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	cps, _, err := a.Srv().Store().AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{
		Type:     model.AccessControlPolicyTypeChannel,
		ParentID: policyID,
		Limit:    1000,
	})
	if err != nil {
		return model.NewAppError("UnassignPoliciesFromChannels", "app.pap.unassign_access_control_policy_from_channels.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	childPolicies := make(map[string]bool)
	for _, p := range cps {
		childPolicies[p.ID] = true
	}

	for _, channelID := range channelIDs {
		if _, ok := childPolicies[channelID]; !ok {
			mlog.Warn("Policy is not assigned to the parent policy", mlog.String("channel_id", channelID), mlog.String("parent_policy_id", policyID))
			continue
		}

		child, appErr := acs.GetPolicy(rctx, channelID)
		if appErr != nil {
			return model.NewAppError("UnassignPoliciesFromChannels", "app.pap.unassign_access_control_policy_from_channels.app_error", nil, appErr.Error(), http.StatusInternalServerError)
		}

		child.Imports = slices.DeleteFunc(child.Imports, func(importID string) bool {
			return importID == policyID
		})
		if len(child.Imports) == 0 && len(child.Rules) == 0 {
			// If the policy has no imports and no rules, we can delete it
			if err := acs.DeletePolicy(rctx, child.ID); err != nil {
				return model.NewAppError("UnassignPoliciesFromChannels", "app.pap.unassign_access_control_policy_from_channels.app_error", nil, err.Error(), http.StatusInternalServerError)
			}
			// invalidate the channel cache
			a.Srv().Store().Channel().InvalidateChannel(channelID)
			continue
		}
		_, appErr = acs.SavePolicy(rctx, child)
		if appErr != nil {
			return model.NewAppError("UnassignPoliciesFromChannels", "app.pap.unassign_access_control_policy_from_channels.app_error", nil, appErr.Error(), http.StatusInternalServerError)
		}
	}

	return nil
}

func (a *App) SearchAccessControlPolicies(rctx request.CTX, opts model.AccessControlPolicySearch) ([]*model.AccessControlPolicy, int64, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, 0, model.NewAppError("SearchAccessControlPolicies", "app.pap.search_access_control_policies.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	policies, total, err := a.Srv().Store().AccessControlPolicy().SearchPolicies(rctx, opts)
	if err != nil {
		return nil, 0, model.NewAppError("SearchAccessControlPolicies", "app.pap.search_access_control_policies.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	for i, policy := range policies {
		if policy.Type != model.AccessControlPolicyTypeParent {
			continue
		}

		normlizedPolicy, appErr := acs.NormalizePolicy(rctx, policy)
		if appErr != nil {
			mlog.Error("Failed to normalize policy", mlog.String("policy_id", policy.ID), mlog.Err(appErr))
			continue
		}
		policies[i] = normlizedPolicy
	}

	return policies, total, nil
}

func (a *App) GetAccessControlPolicyAttributes(rctx request.CTX, channelID string, action string) (map[string][]string, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, model.NewAppError("GetChannelAccessControlAttributes", "app.pap.get_channel_access_control_attributes.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	attributes, appErr := acs.GetPolicyRuleAttributes(rctx, channelID, action)
	if appErr != nil {
		return nil, appErr
	}

	return attributes, nil
}

func (a *App) GetAccessControlFieldsAutocomplete(rctx request.CTX, after string, limit int, callerID string) ([]*model.PropertyField, *model.AppError) {
	cpaGroupID, appErr := a.CpaGroupID()
	if appErr != nil {
		return nil, model.NewAppError("GetAccessControlAutoComplete", "app.pap.get_access_control_auto_complete.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	// Use property app layer to enforce access control
	rctxWithCaller := RequestContextWithCallerID(rctx, callerID)
	fields, appErr := a.SearchPropertyFields(rctxWithCaller, cpaGroupID, model.PropertyFieldSearchOpts{
		Cursor: model.PropertyFieldSearchCursor{
			PropertyFieldID: after,
			CreateAt:        1,
		},
		PerPage: limit,
	})
	if appErr != nil {
		return nil, model.NewAppError("GetAccessControlAutoComplete", "app.pap.get_access_control_auto_complete.app_error", nil, appErr.Error(), http.StatusInternalServerError)
	}

	return fields, nil
}

func (a *App) UpdateAccessControlPoliciesActive(rctx request.CTX, updates []model.AccessControlPolicyActiveUpdate) ([]*model.AccessControlPolicy, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, model.NewAppError("ExpressionToVisualAST", "app.pap.update_access_control_policies_active.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	policies, err := a.Srv().Store().AccessControlPolicy().SetActiveStatusMultiple(rctx, updates)
	if err != nil {
		return nil, model.NewAppError("UpdateAccessControlPoliciesActive", "app.pap.update_access_control_policies_active.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return policies, nil
}

func (a *App) ExpressionToVisualAST(rctx request.CTX, expression string) (*model.VisualExpression, *model.AppError) {
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, model.NewAppError("ExpressionToVisualAST", "app.pap.expression_to_visual_ast.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	visualAST, appErr := acs.ExpressionToVisualAST(rctx, expression)
	if appErr != nil {
		return nil, appErr
	}

	return visualAST, nil
}

// GetMaskedVisualAST returns a visual AST with attribute values filtered based on
// the caller's holdings. For shared_only fields, only values the caller holds are
// returned; for source_only fields, all values are masked. Public fields pass through
// unmasked. HasMaskedValues is set to true on conditions where values were omitted.
// This implements the read-path of attribute-value masking for delegated admins.
func (a *App) GetMaskedVisualAST(rctx request.CTX, expression string, callerID string) (*model.VisualExpression, *model.AppError) {
	visualAST, appErr := a.ExpressionToVisualAST(rctx, expression)
	if appErr != nil {
		return nil, appErr
	}

	cpaGroupID, appErr := a.CpaGroupID()
	if appErr != nil {
		return nil, model.NewAppError("GetMaskedVisualAST", "app.pap.get_masked_visual_ast.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	rctxWithCaller := RequestContextWithCallerID(rctx, callerID)

	for i := range visualAST.Conditions {
		a.maskConditionValues(rctxWithCaller, &visualAST.Conditions[i], cpaGroupID)
	}

	return visualAST, nil
}

// maskConditionValues filters a single condition's values based on the caller's
// attribute holdings and the field's access_mode. Modifies the condition in place.
func (a *App) maskConditionValues(rctx request.CTX, condition *model.Condition, cpaGroupID string) {
	// Skip attribute-to-attribute comparisons — no literal values to mask
	if condition.ValueType == model.AttrValue {
		return
	}

	// Extract the field name from the attribute path (e.g., "user.attributes.Program" → "Program")
	fieldName := extractFieldName(condition.Attribute)
	if fieldName == "" {
		return
	}

	// Look up the field with caller's access control context.
	// GetPropertyFieldByName routes through PropertyAccessService which filters
	// options based on access_mode and caller identity.
	field, appErr := a.GetPropertyFieldByName(rctx, cpaGroupID, "", fieldName)
	if appErr != nil {
		// Fail closed: if we can't look up the field, mask all values.
		// This prevents information leakage when field resolution fails.
		rctx.Logger().Warn("Failed to look up field for masking, failing closed",
			mlog.String("field_name", fieldName),
			mlog.Err(appErr),
		)
		condition.Value = nil
		condition.HasMaskedValues = true
		return
	}

	// Determine the field's access mode
	accessMode := getFieldAccessMode(field)

	switch accessMode {
	case model.PropertyAccessModePublic:
		// Public fields: no masking needed
		return

	case model.PropertyAccessModeSourceOnly:
		// Source-only fields: mask all values for non-plugin callers.
		// The PropertyAccessService already returns empty options for source_only
		// when the caller is not the source plugin, so we mask everything.
		condition.Value = nil
		condition.HasMaskedValues = true
		return

	case model.PropertyAccessModeSharedOnly:
		// Shared-only fields: filter values to the caller-field intersection.
		if field.Type == model.PropertyFieldTypeSelect || field.Type == model.PropertyFieldTypeMultiselect {
			// Select/multiselect: the field returned by GetPropertyFieldByName already has
			// options filtered to only those the caller holds (via PropertyAccessService).
			visibleNames := extractVisibleOptionNames(field)
			filterConditionValues(condition, visibleNames)
		} else {
			// Text (and other) fields: fetch the caller's actual property value and use
			// it as the visible set. The caller can only see condition values that match
			// their own value for this field.
			callerTextValues := a.getCallerTextValues(rctx, field, cpaGroupID)
			filterConditionValues(condition, callerTextValues)
		}
		return

	default:
		// Unknown access mode: fail closed — mask all values
		condition.Value = nil
		condition.HasMaskedValues = true
	}
}

// extractFieldName extracts the field name from an attribute path.
// e.g., "user.attributes.Program" → "Program"
func extractFieldName(attribute string) string {
	const prefix = "user.attributes."
	if strings.HasPrefix(attribute, prefix) {
		return attribute[len(prefix):]
	}
	return ""
}

// getFieldAccessMode extracts the access_mode from a PropertyField's Attrs.
// Returns PropertyAccessModePublic (empty string) if not set.
func getFieldAccessMode(field *model.PropertyField) string {
	if field.Attrs == nil {
		return model.PropertyAccessModePublic
	}
	accessMode, ok := field.Attrs[model.PropertyAttrsAccessMode].(string)
	if !ok {
		return model.PropertyAccessModePublic
	}
	return accessMode
}

// extractVisibleOptionNames extracts option names from a PropertyField's filtered options.
// The field must have already been filtered by PropertyAccessService (caller-aware).
func extractVisibleOptionNames(field *model.PropertyField) map[string]struct{} {
	names := make(map[string]struct{})
	if field.Attrs == nil {
		return names
	}

	optionsRaw, ok := field.Attrs[model.PropertyFieldAttributeOptions]
	if !ok {
		return names
	}

	optionsSlice, ok := optionsRaw.([]any)
	if !ok {
		return names
	}

	for _, opt := range optionsSlice {
		optMap, ok := opt.(map[string]any)
		if !ok {
			continue
		}
		name, ok := optMap["name"].(string)
		if ok && name != "" {
			names[name] = struct{}{}
		}
	}

	return names
}

// getCallerTextValues fetches the caller's actual property value for a text field
// and returns it as a set of visible names. For text fields, the caller can only
// see condition values that exactly match their own value for this field.
func (a *App) getCallerTextValues(rctx request.CTX, field *model.PropertyField, cpaGroupID string) map[string]struct{} {
	visible := make(map[string]struct{})

	callerID, ok := CallerIDFromRequestContext(rctx)
	if !ok || callerID == "" {
		return visible
	}

	// Search for the caller's property value on this field
	values, appErr := a.SearchPropertyValues(rctx, cpaGroupID, model.PropertyValueSearchOpts{
		FieldID:   field.ID,
		TargetIDs: []string{callerID},
		PerPage:   10,
	})
	if appErr != nil || len(values) == 0 {
		return visible
	}

	// Extract the text value from the property value's JSON
	for _, pv := range values {
		var textVal string
		if err := json.Unmarshal(pv.Value, &textVal); err == nil && textVal != "" {
			visible[textVal] = struct{}{}
		}
	}

	return visible
}

// filterConditionValues filters a condition's Value to only include values
// present in the visibleNames set. Sets HasMaskedValues if any values were removed.
func filterConditionValues(condition *model.Condition, visibleNames map[string]struct{}) {
	switch v := condition.Value.(type) {
	case []any:
		// Multi-value (e.g., "in" operator): filter the slice
		var filtered []any
		for _, val := range v {
			if strVal, ok := val.(string); ok {
				if _, visible := visibleNames[strVal]; visible {
					filtered = append(filtered, val)
				}
			}
		}
		if len(filtered) < len(v) {
			condition.HasMaskedValues = true
		}
		condition.Value = filtered

	case string:
		// Single value (e.g., "==" operator): check if visible
		if _, visible := visibleNames[v]; !visible {
			condition.Value = nil
			condition.HasMaskedValues = true
		}

	default:
		// Non-string values (booleans, numbers) or nil: skip masking
		// These types don't correspond to select/multiselect option names
	}
}

// mergeExpressionWithMaskedValues takes the submitted expression (with only visible values)
// and the stored expression (with all values including hidden), identifies which stored values
// were hidden from the caller, and re-injects them into the submitted expression.
// This preserves hidden values that the delegated admin could not see or modify.
func (a *App) mergeExpressionWithMaskedValues(rctx request.CTX, submittedExpr, storedExpr, callerID string) (string, *model.AppError) {
	// Parse both expressions to visual AST
	submittedAST, appErr := a.ExpressionToVisualAST(rctx, submittedExpr)
	if appErr != nil {
		return "", appErr
	}

	storedAST, appErr := a.ExpressionToVisualAST(rctx, storedExpr)
	if appErr != nil {
		return "", appErr
	}

	cpaGroupID, appErr := a.CpaGroupID()
	if appErr != nil {
		return "", model.NewAppError("mergeExpressionWithMaskedValues", "app.pap.merge_expression.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	rctxWithCaller := RequestContextWithCallerID(rctx, callerID)

	// Build a map of stored conditions keyed by attribute for matching.
	// We match by attribute only (not attribute+operator) because the operator can
	// change when the value count changes. For example, multiselect "hasAnyOf" with
	// 2 values becomes "in" with 1 value when the frontend rebuilds the expression
	// with only the visible value. Using the stored operator preserves correctness.
	storedByAttr := make(map[string][]model.Condition)
	for _, cond := range storedAST.Conditions {
		storedByAttr[cond.Attribute] = append(storedByAttr[cond.Attribute], cond)
	}

	// Track how many times each attribute has been matched
	matchCount := make(map[string]int)

	var mergedConditions []model.Condition

	for _, submitted := range submittedAST.Conditions {
		storedList, found := storedByAttr[submitted.Attribute]

		if !found {
			// New condition added by the delegated admin — use as-is
			mergedConditions = append(mergedConditions, submitted)
			continue
		}

		// Match by order within the same attribute
		matchIdx := matchCount[submitted.Attribute]
		matchCount[submitted.Attribute]++

		if matchIdx >= len(storedList) {
			// More submitted conditions than stored for this attribute — treat as new
			mergedConditions = append(mergedConditions, submitted)
			continue
		}

		stored := storedList[matchIdx]

		// Determine which stored values were hidden from the caller
		hiddenValues := a.getHiddenValues(rctxWithCaller, &stored, cpaGroupID)

		// Merge: submitted values + hidden values.
		// Use the STORED condition's operator and attribute type to preserve the
		// original semantics (e.g., hasAnyOf vs in).
		merged := mergeConditionValues(submitted, hiddenValues)
		merged.Operator = stored.Operator
		merged.AttributeType = stored.AttributeType
		mergedConditions = append(mergedConditions, merged)
	}

	// Conditions in stored but NOT in submitted were deleted by the admin — drop them

	return buildCELFromConditions(mergedConditions), nil
}

// getHiddenValues returns the values from a stored condition that are NOT visible to the caller.
func (a *App) getHiddenValues(rctx request.CTX, stored *model.Condition, cpaGroupID string) []string {
	if stored.ValueType == model.AttrValue {
		return nil
	}

	fieldName := extractFieldName(stored.Attribute)
	if fieldName == "" {
		return nil
	}

	field, appErr := a.GetPropertyFieldByName(rctx, cpaGroupID, "", fieldName)
	if appErr != nil {
		// Can't determine visibility — treat all values as hidden to be safe
		return extractStringValues(stored.Value)
	}

	accessMode := getFieldAccessMode(field)
	if accessMode != model.PropertyAccessModeSharedOnly {
		// Public: nothing hidden. Source-only: all hidden (but the admin wouldn't
		// have been able to submit values for source_only fields anyway).
		if accessMode == model.PropertyAccessModeSourceOnly {
			return extractStringValues(stored.Value)
		}
		return nil
	}

	// Shared-only: visible options come from the already-filtered field
	visibleNames := extractVisibleOptionNames(field)
	storedValues := extractStringValues(stored.Value)

	var hidden []string
	for _, val := range storedValues {
		if _, visible := visibleNames[val]; !visible {
			hidden = append(hidden, val)
		}
	}
	return hidden
}

// extractStringValues converts a condition's Value to a slice of strings.
func extractStringValues(value any) []string {
	switch v := value.(type) {
	case []any:
		var result []string
		for _, item := range v {
			if s, ok := item.(string); ok {
				result = append(result, s)
			}
		}
		return result
	case string:
		return []string{v}
	default:
		return nil
	}
}

// mergeConditionValues creates a new condition with submitted values + hidden values appended.
// Deduplicates values to prevent duplicates.
func mergeConditionValues(submitted model.Condition, hiddenValues []string) model.Condition {
	if len(hiddenValues) == 0 {
		return submitted
	}

	merged := submitted

	switch v := submitted.Value.(type) {
	case []any:
		// Build a set of existing values for dedup
		seen := make(map[string]struct{})
		for _, item := range v {
			if s, ok := item.(string); ok {
				seen[s] = struct{}{}
			}
		}
		// Append hidden values that aren't already present
		result := make([]any, len(v))
		copy(result, v)
		for _, hidden := range hiddenValues {
			if _, exists := seen[hidden]; !exists {
				result = append(result, hidden)
			}
		}
		merged.Value = result

	case string:
		// Single value — if the submitted value is empty/nil and there are hidden values,
		// restore the first hidden value. Otherwise, keep the submitted value and add hidden.
		if v == "" && len(hiddenValues) > 0 {
			merged.Value = hiddenValues[0]
		}
		// For single-value operators, the hidden value was the original — the admin
		// can't change it. Keep submitted value; hidden values are carried via the
		// stored expression already (handled at higher level).

	case nil:
		// Admin cleared all visible values; restore hidden values
		if len(hiddenValues) == 1 {
			merged.Value = hiddenValues[0]
		} else if len(hiddenValues) > 1 {
			result := make([]any, 0, len(hiddenValues))
			for _, h := range hiddenValues {
				result = append(result, h)
			}
			merged.Value = result
		}
	}

	return merged
}

// buildCELFromConditions reconstructs a CEL expression string from a slice of Conditions.
// Each condition is formatted based on its operator type, and conditions are joined with " && ".
func buildCELFromConditions(conditions []model.Condition) string {
	if len(conditions) == 0 {
		return "true"
	}

	parts := make([]string, 0, len(conditions))
	for _, cond := range conditions {
		cel := conditionToCEL(cond)
		if cel != "" {
			parts = append(parts, cel)
		}
	}

	if len(parts) == 0 {
		return "true"
	}

	return strings.Join(parts, " && ")
}

// conditionToCEL converts a single Condition to its CEL string representation.
func conditionToCEL(cond model.Condition) string {
	attr := cond.Attribute

	switch cond.Operator {
	case "==", "!=", ">", ">=", "<", "<=":
		// Comparison operators: user.attributes.Field op "value"
		return attr + " " + cond.Operator + " " + celValueLiteral(cond.Value)

	case "in":
		// "in" operator: depends on attribute type
		values := extractStringValues(cond.Value)
		if len(values) == 0 {
			return ""
		}

		if cond.AttributeType == "multiselect" {
			// Multiselect: "val1" in user.attributes.Field && "val2" in user.attributes.Field
			inParts := make([]string, 0, len(values))
			for _, v := range values {
				inParts = append(inParts, celStringLiteral(v)+" in "+attr)
			}
			return strings.Join(inParts, " && ")
		}

		// Select: user.attributes.Field in ["val1", "val2"]
		valLiterals := make([]string, 0, len(values))
		for _, v := range values {
			valLiterals = append(valLiterals, celStringLiteral(v))
		}
		return attr + " in [" + strings.Join(valLiterals, ", ") + "]"

	case "hasAnyOf":
		// HasAnyOf: ("val1" in attr || "val2" in attr)
		values := extractStringValues(cond.Value)
		if len(values) == 0 {
			return ""
		}
		orParts := make([]string, 0, len(values))
		for _, v := range values {
			orParts = append(orParts, celStringLiteral(v)+" in "+attr)
		}
		if len(orParts) == 1 {
			return orParts[0]
		}
		return "(" + strings.Join(orParts, " || ") + ")"

	case "hasAllOf":
		// HasAllOf: "val1" in attr && "val2" in attr
		values := extractStringValues(cond.Value)
		if len(values) == 0 {
			return ""
		}
		andParts := make([]string, 0, len(values))
		for _, v := range values {
			andParts = append(andParts, celStringLiteral(v)+" in "+attr)
		}
		return strings.Join(andParts, " && ")

	case "contains", "startsWith", "endsWith":
		// Method operators: user.attributes.Field.method("value")
		return attr + "." + cond.Operator + "(" + celValueLiteral(cond.Value) + ")"

	default:
		// Unknown operator — best-effort comparison format
		return attr + " " + cond.Operator + " " + celValueLiteral(cond.Value)
	}
}

// celStringLiteral wraps a string in double quotes with proper escaping.
func celStringLiteral(s string) string {
	// Escape backslashes and double quotes
	escaped := strings.ReplaceAll(s, `\`, `\\`)
	escaped = strings.ReplaceAll(escaped, `"`, `\"`)
	return `"` + escaped + `"`
}

// celValueLiteral converts a condition value to its CEL literal representation.
func celValueLiteral(value any) string {
	switch v := value.(type) {
	case string:
		return celStringLiteral(v)
	case float64:
		return strings.TrimRight(strings.TrimRight(fmt.Sprintf("%f", v), "0"), ".")
	case int:
		return fmt.Sprintf("%d", v)
	case int64:
		return fmt.Sprintf("%d", v)
	case bool:
		if v {
			return "true"
		}
		return "false"
	case nil:
		return "null"
	default:
		return fmt.Sprintf("%v", v)
	}
}

// maskedTokenValue is the sentinel token used by the frontend to represent masked values
// in the CEL editor. It must never be accepted as a real attribute value.
const maskedTokenValue = "--------"

// validatePolicyExpressionValues validates that all literal values in a policy's expressions
// are held by the caller for shared_only fields. Rejects source_only literal values entirely.
// Rejects the masked token sentinel value. Returns a generic HTTP 400 "Invalid value." error
// for all rejections — no distinction is made between "value doesn't exist", "value exists
// but you don't hold it", or "value is malformed" to prevent value enumeration.
func (a *App) validatePolicyExpressionValues(rctx request.CTX, policy *model.AccessControlPolicy, callerID string) *model.AppError {
	cpaGroupID, appErr := a.CpaGroupID()
	if appErr != nil {
		return model.NewAppError("validatePolicyExpressionValues", "app.pap.validate_expression_values.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	rctxWithCaller := RequestContextWithCallerID(rctx, callerID)

	for _, rule := range policy.Rules {
		if rule.Expression == "" || rule.Expression == "true" {
			continue
		}

		visualAST, appErr := a.ExpressionToVisualAST(rctx, rule.Expression)
		if appErr != nil {
			return appErr
		}

		for _, cond := range visualAST.Conditions {
			if appErr := a.validateConditionValues(rctxWithCaller, &cond, cpaGroupID); appErr != nil {
				return appErr
			}
		}
	}

	return nil
}

// invalidValueError returns the standard generic error for all write-path value rejections.
// The error message and status code are intentionally identical for all rejection reasons
// to prevent value enumeration attacks.
func invalidValueError() *model.AppError {
	return model.NewAppError("validatePolicyExpressionValues", "app.pap.save_policy.invalid_value", nil, "Invalid value.", http.StatusBadRequest)
}

// validateConditionValues validates that all literal values in a single condition are
// held by the caller.
func (a *App) validateConditionValues(rctx request.CTX, cond *model.Condition, cpaGroupID string) *model.AppError {
	// Skip attribute-to-attribute comparisons
	if cond.ValueType == model.AttrValue {
		return nil
	}

	// Check for the masked token sentinel — never valid as a real value
	values := extractStringValues(cond.Value)
	for _, v := range values {
		if v == maskedTokenValue {
			return invalidValueError()
		}
	}

	fieldName := extractFieldName(cond.Attribute)
	if fieldName == "" {
		return nil
	}

	// Look up the field with the caller's access context
	field, appErr := a.GetPropertyFieldByName(rctx, cpaGroupID, "", fieldName)
	if appErr != nil {
		// Field not found or not accessible — reject to prevent probing
		return invalidValueError()
	}

	accessMode := getFieldAccessMode(field)

	switch accessMode {
	case model.PropertyAccessModePublic:
		// Public fields: no value restrictions
		return nil

	case model.PropertyAccessModeSourceOnly:
		// Source-only fields: delegated admins cannot submit any literal values
		if len(values) > 0 {
			return invalidValueError()
		}
		return nil

	case model.PropertyAccessModeSharedOnly:
		// Shared-only fields: all submitted values must be in the caller's visible set
		var visibleNames map[string]struct{}
		if field.Type == model.PropertyFieldTypeSelect || field.Type == model.PropertyFieldTypeMultiselect {
			visibleNames = extractVisibleOptionNames(field)
		} else {
			visibleNames = a.getCallerTextValues(rctx, field, cpaGroupID)
		}
		for _, v := range values {
			if _, visible := visibleNames[v]; !visible {
				return invalidValueError()
			}
		}
		return nil

	default:
		// Unknown access mode: reject to be safe
		if len(values) > 0 {
			return invalidValueError()
		}
		return nil
	}
}

// ValidateChannelEligibilityForAccessControl checks that a channel is eligible for
// access control policy assignment: must be private, not group-constrained, not shared.
func ValidateChannelEligibilityForAccessControl(channel *model.Channel) *model.AppError {
	if channel.Type != model.ChannelTypePrivate {
		return model.NewAppError("ValidateChannelEligibilityForAccessControl",
			"app.pap.access_control.channel_not_private",
			nil, "Channel is not of type private", http.StatusBadRequest)
	}

	if channel.IsGroupConstrained() {
		return model.NewAppError("ValidateChannelEligibilityForAccessControl",
			"app.pap.access_control.channel_group_constrained",
			nil, "Channel is group constrained", http.StatusBadRequest)
	}

	if channel.IsShared() {
		return model.NewAppError("ValidateChannelEligibilityForAccessControl",
			"app.pap.access_control.channel_shared",
			nil, "Channel is shared", http.StatusBadRequest)
	}

	return nil
}

// ValidateChannelAccessControlPermission validates if a user has permission to manage access control for a specific channel
func (a *App) ValidateChannelAccessControlPermission(rctx request.CTX, userID, channelID string) *model.AppError {
	// Verify the channel exists
	channel, appErr := a.GetChannel(rctx, channelID)
	if appErr != nil {
		return appErr
	}

	// Check if user has channel admin permission for the specific channel
	if ok, _ := a.HasPermissionToChannel(rctx, userID, channelID, model.PermissionManageChannelAccessRules); !ok {
		return model.NewAppError("ValidateChannelAccessControlPermission", "app.pap.access_control.insufficient_channel_permissions", nil, "user_id="+userID+" channel_id="+channelID, http.StatusForbidden)
	}

	if appErr := ValidateChannelEligibilityForAccessControl(channel); appErr != nil {
		return appErr
	}

	return nil
}

// ValidateAccessControlPolicyPermission validates if a user has permission to manage a specific existing access control policy
func (a *App) ValidateAccessControlPolicyPermission(rctx request.CTX, userID, policyID string) *model.AppError {
	return a.ValidateAccessControlPolicyPermissionWithOptions(rctx, userID, policyID, ValidateAccessControlPolicyPermissionOptions{})
}

type ValidateAccessControlPolicyPermissionOptions struct {
	isReadOnly bool
	channelID  string
}

func (a *App) ValidateAccessControlPolicyPermissionWithOptions(rctx request.CTX, userID, policyID string, opts ValidateAccessControlPolicyPermissionOptions) *model.AppError {
	// System admins can manage any policy
	if a.HasPermissionTo(userID, model.PermissionManageSystem) {
		return nil
	}

	// Get the policy to determine its type
	policy, appErr := a.GetAccessControlPolicy(rctx, policyID)
	if appErr != nil {
		return appErr
	}

	// For read-only operations, allow access to system policies if they're applied to the specific channel
	if opts.isReadOnly && policy.Type != model.AccessControlPolicyTypeChannel && opts.channelID != "" {
		// Check if user has access to the channel
		if ok, _ := a.HasPermissionToChannel(rctx, userID, opts.channelID, model.PermissionReadChannel); !ok {
			return model.NewAppError("ValidateAccessControlPolicyPermissionWithOptions", "app.pap.access_control.insufficient_permissions", nil, "user_id="+userID+" channel_id="+opts.channelID, http.StatusForbidden)
		}

		// Check if this system policy is applied to the specific channel
		if a.isSystemPolicyAppliedToChannel(rctx, policyID, opts.channelID) {
			return nil // Allow read-only access
		}
		return model.NewAppError("ValidateAccessControlPolicyPermissionWithOptions", "app.pap.access_control.insufficient_permissions", nil, "user_id="+userID+" policy_type="+policy.Type+" channel_id="+opts.channelID, http.StatusForbidden)
	}

	// Non-system admins can only manage channel-type policies (for non-read-only operations)
	if policy.Type != model.AccessControlPolicyTypeChannel {
		return model.NewAppError("ValidateAccessControlPolicyPermissionWithOptions", "app.pap.access_control.insufficient_permissions", nil, "user_id="+userID+" policy_type="+policy.Type, http.StatusForbidden)
	}

	// For channel-type policies, validate channel-specific permission (policy ID equals channel ID)
	return a.ValidateChannelAccessControlPermission(rctx, userID, policyID)
}

// ValidateAccessControlPolicyPermissionWithMode validates access control policy permissions with read-only mode option
func (a *App) ValidateAccessControlPolicyPermissionWithMode(rctx request.CTX, userID, policyID string, isReadOnly bool) *model.AppError {
	return a.ValidateAccessControlPolicyPermissionWithOptions(rctx, userID, policyID, ValidateAccessControlPolicyPermissionOptions{
		isReadOnly: isReadOnly,
	})
}

// ValidateAccessControlPolicyPermissionWithChannelContext validates access control policy permissions with channel context
func (a *App) ValidateAccessControlPolicyPermissionWithChannelContext(rctx request.CTX, userID, policyID string, isReadOnly bool, channelID string) *model.AppError {
	return a.ValidateAccessControlPolicyPermissionWithOptions(rctx, userID, policyID, ValidateAccessControlPolicyPermissionOptions{
		isReadOnly: isReadOnly,
		channelID:  channelID,
	})
}

// isSystemPolicyAppliedToChannel checks if a system policy is applied to a specific channel
func (a *App) isSystemPolicyAppliedToChannel(rctx request.CTX, policyID, channelID string) bool {
	// Get the channel's policy (channel ID = policy ID for channel policies)
	channelPolicy, err := a.GetAccessControlPolicy(rctx, channelID)
	if err != nil {
		return false // Channel doesn't have a policy
	}

	// Check if the channel policy imports this system policy
	if channelPolicy.Imports != nil {
		return slices.Contains(channelPolicy.Imports, policyID)
	}

	return false
}

// ValidateChannelAccessControlPolicyCreation validates if a user can create a channel-specific access control policy
func (a *App) ValidateChannelAccessControlPolicyCreation(rctx request.CTX, userID string, policy *model.AccessControlPolicy) *model.AppError {
	// System admins can create any type of policy
	if a.HasPermissionTo(userID, model.PermissionManageSystem) {
		return nil
	}

	// Non-system admins can only create channel-type policies
	if policy.Type != model.AccessControlPolicyTypeChannel {
		return model.NewAppError("ValidateChannelAccessControlPolicyCreation", "app.access_control.insufficient_permissions", nil, "user_id="+userID+" policy_type="+policy.Type, http.StatusForbidden)
	}

	// For channel-type policies, validate channel-specific permission (policy ID equals channel ID)
	return a.ValidateChannelAccessControlPermission(rctx, userID, policy.ID)
}

// TestExpressionWithChannelContext tests expressions for channel admins with attribute validation
// Channel admins can only see users that match expressions they themselves would match
func (a *App) TestExpressionWithChannelContext(rctx request.CTX, expression string, opts model.SubjectSearchOptions) ([]*model.User, int64, *model.AppError) {
	// Get the current user (channel admin)
	session := rctx.Session()
	if session == nil {
		return nil, 0, model.NewAppError("TestExpressionWithChannelContext", "api.context.session_expired.app_error", nil, "", http.StatusUnauthorized)
	}

	currentUserID := session.UserId

	// SECURITY: First check if the channel admin themselves matches this expression
	// If they don't match, they shouldn't be able to see users who do
	adminMatches, appErr := a.ValidateExpressionAgainstRequester(rctx, expression, currentUserID)
	if appErr != nil {
		return nil, 0, appErr
	}

	if !adminMatches {
		// Channel admin doesn't match the expression, so return empty results
		return []*model.User{}, 0, nil
	}

	// If the channel admin matches the expression, run it against all users
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, 0, model.NewAppError("TestExpressionWithChannelContext", "app.pap.check_expression.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	return a.TestExpression(rctx, expression, opts)
}

// ValidateExpressionAgainstRequester validates an expression directly against a specific user
func (a *App) ValidateExpressionAgainstRequester(rctx request.CTX, expression string, requesterID string) (bool, *model.AppError) {
	// Self-exclusion validation should work with any attribute
	// Channel admins should be able to validate any expression they're testing

	// Use access control service to evaluate expression
	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return false, model.NewAppError("ValidateExpressionAgainstRequester", "app.pap.check_expression.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	// Search only for the specific requester user ID
	users, _, appErr := acs.QueryUsersForExpression(rctx, expression, model.SubjectSearchOptions{
		SubjectID: requesterID, // Only check this specific user
		Limit:     1,           // Maximum 1 result expected
	})
	if appErr != nil {
		return false, appErr
	}
	if len(users) == 1 && users[0].Id == requesterID {
		return true, nil
	}
	return false, nil
}

// BuildAccessControlSubject creates a fully populated Subject with user attributes and system role
// for use in AccessEvaluation calls. It also ensures the materialized attribute view is
// refreshed periodically (at most once per attributeViewRefreshInterval).
func (a *App) BuildAccessControlSubject(rctx request.CTX, userID string, roles string) (*model.Subject, *model.AppError) {
	a.refreshAttributeViewIfStale(rctx)

	groupID, err := a.CpaGroupID()
	if err != nil {
		return nil, model.NewAppError("BuildAccessControlSubject", "app.access_control.build_subject.group_id.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	subject, storeErr := a.Srv().Store().Attributes().GetSubject(rctx, userID, groupID)
	if storeErr != nil {
		var nfErr *store.ErrNotFound
		if errors.As(storeErr, &nfErr) {
			return &model.Subject{
				ID:         userID,
				Type:       "user",
				Role:       roles,
				Attributes: map[string]any{},
			}, nil
		}

		rctx.Logger().Warn("Failed to get subject for access control subject",
			mlog.String("user_id", userID),
			mlog.String("roles", roles),
			mlog.Err(storeErr),
		)
		return nil, model.NewAppError("BuildAccessControlSubject", "app.access_control.build_subject.get_subject.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
	}

	subject.Role = roles
	return subject, nil
}

// refreshAttributeViewIfStale refreshes the materialized AttributeView if the last
// refresh was more than attributeViewRefreshInterval ago. The refresh is non-blocking:
// if another goroutine is already refreshing, this call returns immediately.
func (a *App) refreshAttributeViewIfStale(rctx request.CTX) {
	ch := a.Srv().Channels()

	if !ch.attributeViewRefreshMut.TryLock() {
		return
	}
	defer ch.attributeViewRefreshMut.Unlock()

	if time.Since(ch.attributeViewRefreshLast) < attributeViewRefreshInterval {
		return
	}

	if err := a.Srv().Store().Attributes().RefreshAttributes(); err != nil {
		rctx.Logger().Warn("Failed to refresh attribute materialized view", mlog.Err(err))
		return
	}

	ch.attributeViewRefreshLast = time.Now()
}
