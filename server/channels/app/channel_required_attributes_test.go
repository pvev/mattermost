// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func requiredAttributesSessionCtx(th *TestHelper, user *model.User, roles string) request.CTX {
	return th.Context.WithSession(&model.Session{UserId: user.Id, Id: model.NewId(), Roles: roles})
}

func fieldIDsOf(fields []*model.PropertyField) []string {
	ids := make([]string, 0, len(fields))
	for _, field := range fields {
		ids = append(ids, field.ID)
	}
	return ids
}

func requireResolveError(t *testing.T, appErr *model.AppError, id string, status int) {
	t.Helper()
	require.NotNil(t, appErr)
	assert.Equal(t, id, appErr.Id)
	assert.Equal(t, status, appErr.StatusCode)
}

func TestResolveRequiredChannelAttributes(t *testing.T) {
	mainHelper.Parallel(t)

	// newExisting returns a helper, a channel administered by admin, and a plain
	// member of it. The channel is created before any field exists.
	newExisting := func(t *testing.T) (*TestHelper, *model.Channel, *model.User, *model.User) {
		t.Helper()
		th := setupMissingAttributes(t)
		team, admin := newAttributesTeamAndMember(t, th)
		channel := administeredChannel(t, th, team, admin, model.ChannelTypeOpen, "Existing")
		member := th.CreateUser(t)
		th.LinkUserToTeam(t, member, team)
		th.AddUserToChannel(t, member, channel)
		return th, channel, admin, member
	}

	t.Run("existing channel", func(t *testing.T) {
		t.Run("a settable required field with no value is missing", func(t *testing.T) {
			th, channel, admin, _ := newExisting(t)
			field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

			res, appErr := th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin.Id, channel, false, nil)
			require.Nil(t, appErr)
			assert.Equal(t, []string{field.ID}, fieldIDsOf(res.Missing))
			assert.Empty(t, res.Skipped)
			assert.Empty(t, res.ValuesToWrite)
		})

		t.Run("a field with a value is not asked for", func(t *testing.T) {
			th, channel, admin, _ := newExisting(t)
			field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
			setChannelPropertyValue(t, th, field.GroupID, field.ID, channel.Id, `"ALPHA"`)

			res, appErr := th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin.Id, channel, false, nil)
			require.Nil(t, appErr)
			assert.Empty(t, res.Missing)
			assert.Empty(t, res.Skipped)
		})

		t.Run("a whitespace-only value counts as missing", func(t *testing.T) {
			th, channel, admin, _ := newExisting(t)
			field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
			setChannelPropertyValue(t, th, field.GroupID, field.ID, channel.Id, `"   "`)

			res, appErr := th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin.Id, channel, false, nil)
			require.Nil(t, appErr)
			assert.Equal(t, []string{field.ID}, fieldIDsOf(res.Missing))
		})

		t.Run("an optional field is not asked for", func(t *testing.T) {
			th, channel, admin, _ := newExisting(t)
			createMissingAttributesField(t, th, "Optional", false, model.PermissionLevelAdmin)

			res, appErr := th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin.Id, channel, false, nil)
			require.Nil(t, appErr)
			assert.Empty(t, res.Missing)
			assert.Empty(t, res.Skipped)
		})

		t.Run("a field the person can't set is skipped", func(t *testing.T) {
			th, channel, admin, member := newExisting(t)
			field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

			res, appErr := th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, member, model.SystemUserRoleId), member.Id, channel, false, nil)
			require.Nil(t, appErr)
			assert.Empty(t, res.Missing)
			assert.Equal(t, []string{field.ID}, fieldIDsOf(res.Skipped))

			res, appErr = th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin.Id, channel, false, nil)
			require.Nil(t, appErr)
			assert.Equal(t, []string{field.ID}, fieldIDsOf(res.Missing))
		})

		t.Run("a field with no editor is skipped, never missing", func(t *testing.T) {
			th, channel, admin, _ := newExisting(t)
			for _, fieldType := range []model.PropertyFieldType{model.PropertyFieldTypeDate, model.PropertyFieldTypeUser, model.PropertyFieldTypeMultiuser} {
				createMissingAttributesFieldOfType(t, th, fieldType, "No editor "+string(fieldType), true, model.PermissionLevelAdmin)
			}

			res, appErr := th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin.Id, channel, false, nil)
			require.Nil(t, appErr)
			assert.Empty(t, res.Missing)
			assert.Len(t, res.Skipped, 3)
		})

		t.Run("a sent value satisfies its field and is returned for writing", func(t *testing.T) {
			th, channel, admin, _ := newExisting(t)
			field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
			other := createMissingAttributesField(t, th, "Other", true, model.PermissionLevelAdmin)

			res, appErr := th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin.Id, channel, false, []model.PropertyValuePatchItem{
				{FieldID: field.ID, Value: json.RawMessage(`"  ALPHA  "`)},
			})
			require.Nil(t, appErr)
			assert.Equal(t, []string{other.ID}, fieldIDsOf(res.Missing))
			require.Len(t, res.ValuesToWrite, 1)
			assert.Equal(t, field.GroupID, res.ValuesToWrite[0].GroupID)
			assert.Equal(t, field.ID, res.ValuesToWrite[0].FieldID)
			assert.JSONEq(t, `"ALPHA"`, string(res.ValuesToWrite[0].Value))
		})

		t.Run("a sent empty or whitespace value leaves the field missing", func(t *testing.T) {
			th, channel, admin, _ := newExisting(t)
			field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

			for _, value := range []string{`""`, `"   "`, `null`} {
				res, appErr := th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin.Id, channel, false, []model.PropertyValuePatchItem{
					{FieldID: field.ID, Value: json.RawMessage(value)},
				})
				require.Nil(t, appErr, value)
				assert.Equal(t, []string{field.ID}, fieldIDsOf(res.Missing), value)
			}
		})

		t.Run("an archived channel is resolved like an active one", func(t *testing.T) {
			th, channel, admin, _ := newExisting(t)
			require.Nil(t, th.App.DeleteChannel(th.Context, channel, admin.Id))
			archived, appErr := th.App.GetChannel(th.Context, channel.Id)
			require.Nil(t, appErr)
			field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

			res, appErr := th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin.Id, archived, false, nil)
			require.Nil(t, appErr)
			assert.Equal(t, []string{field.ID}, fieldIDsOf(res.Missing))
		})

		t.Run("a channel that takes no attributes resolves to nothing, and refuses values", func(t *testing.T) {
			th, _, admin, _ := newExisting(t)
			field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
			direct := &model.Channel{Id: model.NewId(), Type: model.ChannelTypeDirect}
			ctx := requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId)

			res, appErr := th.App.resolveRequiredChannelAttributes(ctx, admin.Id, direct, false, nil)
			require.Nil(t, appErr)
			assert.Empty(t, res.Missing)
			assert.Empty(t, res.Skipped)

			_, appErr = th.App.resolveRequiredChannelAttributes(ctx, admin.Id, direct, false, []model.PropertyValuePatchItem{
				{FieldID: field.ID, Value: json.RawMessage(`"x"`)},
			})
			requireResolveError(t, appErr, "api.channel.create_channel.invalid_attribute.app_error", http.StatusBadRequest)
		})
	})

	t.Run("pending channel", func(t *testing.T) {
		newPending := func(t *testing.T) (*TestHelper, *model.Channel, *model.User) {
			t.Helper()
			th := setupMissingAttributes(t)
			_, user := newAttributesTeamAndMember(t, th)
			return th, &model.Channel{Type: model.ChannelTypeGroup}, user
		}

		t.Run("every settable required field is missing, whatever the stored values", func(t *testing.T) {
			th, channel, user := newPending(t)
			member := createMissingAttributesField(t, th, "Member", true, model.PermissionLevelMember)
			admin := createMissingAttributesField(t, th, "Admin", true, model.PermissionLevelAdmin)

			res, appErr := th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, user, model.SystemUserRoleId), user.Id, channel, true, nil)
			require.Nil(t, appErr)
			assert.ElementsMatch(t, []string{member.ID, admin.ID}, fieldIDsOf(res.Missing))
			assert.Empty(t, res.Skipped)
		})

		t.Run("a system admin level field is skipped unless the person has manage_system", func(t *testing.T) {
			th, channel, user := newPending(t)
			field := createMissingAttributesField(t, th, "Sysadmin only", true, model.PermissionLevelSysadmin)

			res, appErr := th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, user, model.SystemUserRoleId), user.Id, channel, true, nil)
			require.Nil(t, appErr)
			assert.Empty(t, res.Missing)
			assert.Equal(t, []string{field.ID}, fieldIDsOf(res.Skipped))

			res, appErr = th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, user, model.SystemAdminRoleId), user.Id, channel, true, nil)
			require.Nil(t, appErr)
			assert.Equal(t, []string{field.ID}, fieldIDsOf(res.Missing))
			assert.Empty(t, res.Skipped)
		})

		t.Run("a field no one can set is skipped", func(t *testing.T) {
			th, channel, user := newPending(t)
			field := createMissingAttributesField(t, th, "Nobody", true, model.PermissionLevelNone)

			res, appErr := th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, user, model.SystemUserRoleId), user.Id, channel, true, nil)
			require.Nil(t, appErr)
			assert.Empty(t, res.Missing)
			assert.Equal(t, []string{field.ID}, fieldIDsOf(res.Skipped))
		})

		t.Run("a field with no editor is skipped, never missing", func(t *testing.T) {
			th, channel, user := newPending(t)
			field := createMissingAttributesFieldOfType(t, th, model.PropertyFieldTypeDate, "Date", true, model.PermissionLevelMember)

			res, appErr := th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, user, model.SystemUserRoleId), user.Id, channel, true, nil)
			require.Nil(t, appErr)
			assert.Empty(t, res.Missing)
			assert.Equal(t, []string{field.ID}, fieldIDsOf(res.Skipped))
		})

		t.Run("sent values are not asked for again", func(t *testing.T) {
			th, channel, user := newPending(t)
			field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

			res, appErr := th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, user, model.SystemUserRoleId), user.Id, channel, true, []model.PropertyValuePatchItem{
				{FieldID: field.ID, Value: json.RawMessage(`"ALPHA"`)},
			})
			require.Nil(t, appErr)
			assert.Empty(t, res.Missing)
			assert.Empty(t, res.Skipped)
			require.Len(t, res.ValuesToWrite, 1)
			assert.Equal(t, field.ID, res.ValuesToWrite[0].FieldID)
		})

		t.Run("a whitespace-only text value is still missing", func(t *testing.T) {
			th, channel, user := newPending(t)
			field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)

			res, appErr := th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, user, model.SystemUserRoleId), user.Id, channel, true, []model.PropertyValuePatchItem{
				{FieldID: field.ID, Value: json.RawMessage(`"   "`)},
			})
			require.Nil(t, appErr)
			assert.Equal(t, []string{field.ID}, fieldIDsOf(res.Missing))
		})
	})

	t.Run("sent values are validated like channel creation validates them", func(t *testing.T) {
		for _, pending := range []bool{false, true} {
			name := "existing channel"
			if pending {
				name = "pending channel"
			}
			t.Run(name, func(t *testing.T) {
				th, channel, admin, _ := newExisting(t)
				if pending {
					channel = &model.Channel{Type: model.ChannelTypeGroup}
				}
				ctx := requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId)
				field := createMissingAttributesField(t, th, "Program", false, model.PermissionLevelAdmin)
				noOne := createMissingAttributesField(t, th, "Nobody", false, model.PermissionLevelNone)
				resolve := func(items ...model.PropertyValuePatchItem) *model.AppError {
					_, appErr := th.App.resolveRequiredChannelAttributes(ctx, admin.Id, channel, pending, items)
					return appErr
				}
				value := json.RawMessage(`"x"`)

				requireResolveError(t, resolve(model.PropertyValuePatchItem{FieldID: "not-an-id", Value: value}),
					"api.channel.create_channel.invalid_attribute.app_error", http.StatusBadRequest)
				requireResolveError(t, resolve(model.PropertyValuePatchItem{FieldID: model.NewId(), Value: value}),
					"api.channel.create_channel.invalid_attribute.app_error", http.StatusBadRequest)
				requireResolveError(t, resolve(
					model.PropertyValuePatchItem{FieldID: field.ID, Value: value},
					model.PropertyValuePatchItem{FieldID: field.ID, Value: value},
				), "api.channel.create_channel.invalid_attribute.app_error", http.StatusBadRequest)
				requireResolveError(t, resolve(model.PropertyValuePatchItem{FieldID: noOne.ID, Value: value}),
					"api.channel.create_channel.attribute_no_permission.app_error", http.StatusForbidden)
				assert.Nil(t, resolve(model.PropertyValuePatchItem{FieldID: field.ID, Value: value}))
			})
		}
	})

	t.Run("a field whose own feature is off is refused", func(t *testing.T) {
		th, channel, admin, _ := newExisting(t)
		group, appErr := th.App.GetPropertyGroup(th.Context, model.AccessControlPropertyGroupName)
		require.Nil(t, appErr)

		template, err := th.App.Srv().Store().PropertyField().Create(&model.PropertyField{
			GroupID:    group.ID,
			Name:       "classification",
			Type:       model.PropertyFieldTypeText,
			ObjectType: model.PropertyFieldObjectTypeTemplate,
			TargetType: string(model.PropertyFieldTargetLevelSystem),
			Permissions: &model.Permissions{Restrictions: &model.Restrictions{
				Field: model.WriteOnly{Write: model.PermissionLevelSysadmin},
			}},
		})
		require.NoError(t, err)
		classification, err := th.App.Srv().Store().PropertyField().Create(&model.PropertyField{
			GroupID:       group.ID,
			Name:          "classification",
			Type:          model.PropertyFieldTypeText,
			ObjectType:    model.PropertyFieldObjectTypeChannel,
			TargetType:    string(model.PropertyFieldTargetLevelSystem),
			LinkedFieldID: &template.ID,
			Permissions: &model.Permissions{Restrictions: &model.Restrictions{
				Field: model.WriteOnly{Write: model.PermissionLevelSysadmin},
			}},
		})
		require.NoError(t, err)

		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.ClassificationMarkings = false })
		_, appErr = th.App.resolveRequiredChannelAttributes(requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId), admin.Id, channel, false, []model.PropertyValuePatchItem{
			{FieldID: classification.ID, Value: json.RawMessage(`"x"`)},
		})
		requireResolveError(t, appErr, "api.channel.create_channel.attributes_feature_disabled.app_error", http.StatusBadRequest)
	})

	t.Run("with required attributes off", func(t *testing.T) {
		items := []model.PropertyValuePatchItem{{FieldID: model.NewId(), Value: json.RawMessage(`"x"`)}}
		channel := &model.Channel{Id: model.NewId(), TeamId: model.NewId(), Type: model.ChannelTypeOpen}

		for name, setup := range map[string]func(t *testing.T) *TestHelper{
			"flag off": func(t *testing.T) *TestHelper {
				// The mock store has no expectations beyond start-up, so any query fails the test.
				th := SetupConfigWithStoreMock(t, func(cfg *model.Config) {
					cfg.FeatureFlags.ChannelAttributes = true
					cfg.FeatureFlags.ChannelAttributesRequired = false
				})
				th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
				return th
			},
			"license below Enterprise Advanced": func(t *testing.T) *TestHelper {
				th := SetupConfigWithStoreMock(t, setupMissingAttributesConfig)
				th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterprise))
				return th
			},
			"no license": func(t *testing.T) *TestHelper {
				return SetupConfigWithStoreMock(t, setupMissingAttributesConfig)
			},
		} {
			t.Run(name+" without values returns nothing and runs no query", func(t *testing.T) {
				th := setup(t)
				for _, pending := range []bool{false, true} {
					res, appErr := th.App.resolveRequiredChannelAttributes(th.Context, model.NewId(), channel, pending, nil)
					require.Nil(t, appErr)
					require.NotNil(t, res)
					assert.Empty(t, res.ValuesToWrite)
					assert.Empty(t, res.Missing)
					assert.Empty(t, res.Skipped)
				}
			})

			t.Run(name+" with values is refused as creation refuses them", func(t *testing.T) {
				th := setup(t)
				for _, pending := range []bool{false, true} {
					res, appErr := th.App.resolveRequiredChannelAttributes(th.Context, model.NewId(), channel, pending, items)
					assert.Nil(t, res)
					requireResolveError(t, appErr, "api.channel.create_channel.attributes_feature_disabled.app_error", http.StatusBadRequest)
				}
			})
		}
	})
}

func TestWriteChannelAttributeValues(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("writes the resolved values onto the channel", func(t *testing.T) {
		th := setupMissingAttributes(t)
		team, admin := newAttributesTeamAndMember(t, th)
		channel := administeredChannel(t, th, team, admin, model.ChannelTypeOpen, "Existing")
		field := createMissingAttributesField(t, th, "Program", true, model.PermissionLevelAdmin)
		ctx := requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId)

		res, appErr := th.App.resolveRequiredChannelAttributes(ctx, admin.Id, channel, false, []model.PropertyValuePatchItem{
			{FieldID: field.ID, Value: json.RawMessage(`"ALPHA"`)},
		})
		require.Nil(t, appErr)
		require.Nil(t, th.App.writeChannelAttributeValues(ctx, channel, admin.Id, res.ValuesToWrite))

		missing, appErr := th.App.missingRequiredChannelAttributes(th.Context, channel)
		require.Nil(t, appErr)
		assert.Empty(t, missing)

		stored, err := th.App.Srv().Store().PropertyValue().SearchPropertyValues(th.Context, model.PropertyValueSearchOpts{
			GroupID:    field.GroupID,
			TargetType: model.PropertyValueTargetTypeChannel,
			TargetIDs:  []string{channel.Id},
			PerPage:    10,
		})
		require.NoError(t, err)
		require.Len(t, stored, 1)
		assert.JSONEq(t, `"ALPHA"`, string(stored[0].Value))
		assert.Equal(t, admin.Id, stored[0].CreatedBy)
	})

	t.Run("nothing to write is not an error", func(t *testing.T) {
		th := setupMissingAttributes(t)
		require.Nil(t, th.App.writeChannelAttributeValues(th.Context, th.BasicChannel, th.BasicUser.Id, nil))
	})

	t.Run("a value the hooks refuse is returned", func(t *testing.T) {
		th := setupMissingAttributes(t)
		team, admin := newAttributesTeamAndMember(t, th)
		channel := administeredChannel(t, th, team, admin, model.ChannelTypeOpen, "Existing")
		field := createMissingAttributesFieldOfType(t, th, model.PropertyFieldTypeSelect, "Program", true, model.PermissionLevelAdmin)
		ctx := requiredAttributesSessionCtx(th, admin, model.SystemUserRoleId)

		res, appErr := th.App.resolveRequiredChannelAttributes(ctx, admin.Id, channel, false, []model.PropertyValuePatchItem{
			{FieldID: field.ID, Value: json.RawMessage(`"` + model.NewId() + `"`)},
		})
		require.Nil(t, appErr)
		require.NotNil(t, th.App.writeChannelAttributeValues(ctx, channel, admin.Id, res.ValuesToWrite))
	})
}

// The tiers that need a session are covered by TestCreateChannelWithPropertyValues.
// This covers the ones that must answer no without consulting one, because on the
// create path this function is the only gate: a field the property API would refuse
// a value for must not become settable by creating a channel.
func TestCanSetChannelAttributeOnPendingChannel(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	member := model.PermissionLevelMember
	admin := model.PermissionLevelAdmin
	none := model.PermissionLevelNone
	unknown := model.PermissionLevel("supervisor")

	t.Run("member and admin are satisfied by creation itself", func(t *testing.T) {
		require.True(t, th.App.CanSetChannelAttributeOnPendingChannel(th.Context, &model.PropertyField{PermissionValues: &member}))
		require.True(t, th.App.CanSetChannelAttributeOnPendingChannel(th.Context, &model.PropertyField{PermissionValues: &admin}))
	})

	t.Run("none is never settable", func(t *testing.T) {
		require.False(t, th.App.CanSetChannelAttributeOnPendingChannel(th.Context, &model.PropertyField{PermissionValues: &none}))
	})

	t.Run("an unset tier is not settable", func(t *testing.T) {
		require.False(t, th.App.CanSetChannelAttributeOnPendingChannel(th.Context, &model.PropertyField{}))
	})

	t.Run("an unrecognised tier is not settable", func(t *testing.T) {
		require.False(t, th.App.CanSetChannelAttributeOnPendingChannel(th.Context, &model.PropertyField{PermissionValues: &unknown}))
	})

	sysadmin := model.PermissionLevelSysadmin

	t.Run("sysadmin tier is settable by a caller with manage_system", func(t *testing.T) {
		rctx := th.Context.WithSession(&model.Session{Roles: model.SystemAdminRoleId})
		require.True(t, th.App.CanSetChannelAttributeOnPendingChannel(rctx, &model.PropertyField{PermissionValues: &sysadmin}))
	})

	t.Run("sysadmin tier is not settable by a caller without manage_system", func(t *testing.T) {
		rctx := th.Context.WithSession(&model.Session{Roles: model.SystemUserRoleId})
		require.False(t, th.App.CanSetChannelAttributeOnPendingChannel(rctx, &model.PropertyField{PermissionValues: &sysadmin}))
	})
}
