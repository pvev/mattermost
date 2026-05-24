// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"database/sql"

	sq "github.com/mattermost/squirrel"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const accessControlBypassesTable = "AccessControlBypasses"

var accessControlBypassColumns = []string{
	"Id",
	"SubjectType",
	"SubjectId",
	"ResourceType",
	"ResourceId",
	"Action",
	"Reason",
	"InviteMode",
	"AcceptedAt",
	"JoinedAt",
	"MembershipCreated",
	"CreateAt",
	"UpdateAt",
	"ExpiresAt",
	"DeleteAt",
	"CreatedBy",
	"DeletedBy",
}

type SqlAccessControlBypassStore struct {
	*SqlStore

	selectQuery sq.SelectBuilder
}

func newSqlAccessControlBypassStore(sqlStore *SqlStore) store.AccessControlBypassStore {
	s := &SqlAccessControlBypassStore{SqlStore: sqlStore}
	s.selectQuery = s.getQueryBuilder().
		Select(accessControlBypassColumns...).
		From(accessControlBypassesTable)
	return s
}

func accessControlBypassToMap(b *model.AccessControlBypass) map[string]any {
	return map[string]any{
		"Id":                b.ID,
		"SubjectType":       b.SubjectType,
		"SubjectId":         b.SubjectID,
		"ResourceType":      b.ResourceType,
		"ResourceId":        b.ResourceID,
		"Action":            b.Action,
		"Reason":            b.Reason,
		"InviteMode":        b.InviteMode,
		"AcceptedAt":        b.AcceptedAt,
		"JoinedAt":          b.JoinedAt,
		"MembershipCreated": b.MembershipCreated,
		"CreateAt":          b.CreateAt,
		"UpdateAt":          b.UpdateAt,
		"ExpiresAt":         b.ExpiresAt,
		"DeleteAt":          b.DeleteAt,
		"CreatedBy":         b.CreatedBy,
		"DeletedBy":         b.DeletedBy,
	}
}

func (s *SqlAccessControlBypassStore) Save(rctx request.CTX, bypasses []*model.AccessControlBypass) ([]*model.AccessControlBypass, error) {
	if len(bypasses) == 0 {
		return []*model.AccessControlBypass{}, nil
	}

	tx, err := s.GetMaster().Begin()
	if err != nil {
		return nil, errors.Wrap(err, "failed to start transaction")
	}
	defer finalizeTransactionX(tx, &err)

	for _, bypass := range bypasses {
		bypass.PreSave()
		if appErr := bypass.IsValid(); appErr != nil {
			return nil, appErr
		}

		query := s.getQueryBuilder().
			Insert(accessControlBypassesTable).
			SetMap(accessControlBypassToMap(bypass))
		if _, err = tx.ExecBuilder(query); err != nil {
			return nil, errors.Wrapf(err, "failed to save AccessControlBypass with id=%s", bypass.ID)
		}
	}

	if err = tx.Commit(); err != nil {
		return nil, errors.Wrap(err, "commit_transaction")
	}

	return bypasses, nil
}

func (s *SqlAccessControlBypassStore) Get(_ request.CTX, id string) (*model.AccessControlBypass, error) {
	if !model.IsValidId(id) {
		return nil, store.NewErrInvalidInput("AccessControlBypass", "id", id)
	}

	var bypass model.AccessControlBypass
	query := s.selectQuery.Where(sq.Eq{"Id": id})
	if err := s.GetReplica().GetBuilder(&bypass, query); err != nil {
		if err == sql.ErrNoRows {
			return nil, store.NewErrNotFound("AccessControlBypass", id)
		}
		return nil, errors.Wrapf(err, "failed to get AccessControlBypass with id=%s", id)
	}

	return &bypass, nil
}

func (s *SqlAccessControlBypassStore) Search(_ request.CTX, opts model.AccessControlBypassSearch) ([]*model.AccessControlBypass, int64, error) {
	where := sq.And{}
	if opts.SubjectType != "" {
		where = append(where, sq.Eq{"SubjectType": opts.SubjectType})
	}
	if opts.SubjectID != "" {
		where = append(where, sq.Eq{"SubjectId": opts.SubjectID})
	}
	if opts.ResourceType != "" {
		where = append(where, sq.Eq{"ResourceType": opts.ResourceType})
	}
	if opts.ResourceID != "" {
		where = append(where, sq.Eq{"ResourceId": opts.ResourceID})
	}
	if opts.Action != "" {
		where = append(where, sq.Eq{"Action": opts.Action})
	}
	if opts.CreatedBy != "" {
		where = append(where, sq.Eq{"CreatedBy": opts.CreatedBy})
	}

	now := model.GetMillis()
	switch opts.Status {
	case model.AccessControlBypassStatusActive:
		where = append(where, sq.Eq{"DeleteAt": 0}, sq.Gt{"ExpiresAt": now})
	case model.AccessControlBypassStatusExpired:
		where = append(where, sq.Eq{"DeleteAt": 0}, sq.LtOrEq{"ExpiresAt": now})
	case model.AccessControlBypassStatusRevoked:
		where = append(where, sq.NotEq{"DeleteAt": 0})
	}

	perPage := opts.PerPage
	if perPage <= 0 {
		perPage = DefaultPerPage
	}
	if perPage > MaxPerPage {
		perPage = MaxPerPage
	}
	page := max(opts.Page, 0)

	listQuery := s.selectQuery.
		Where(where).
		OrderBy("CreateAt DESC", "Id DESC").
		Limit(uint64(perPage)).
		Offset(uint64(page * perPage))

	var bypasses []*model.AccessControlBypass
	if err := s.GetReplica().SelectBuilder(&bypasses, listQuery); err != nil {
		return nil, 0, errors.Wrap(err, "failed to search AccessControlBypasses")
	}

	countQuery := s.getQueryBuilder().
		Select("COUNT(*)").
		From(accessControlBypassesTable).
		Where(where)

	var total int64
	if err := s.GetReplica().GetBuilder(&total, countQuery); err != nil {
		return nil, 0, errors.Wrap(err, "failed to count AccessControlBypasses")
	}

	return bypasses, total, nil
}

func (s *SqlAccessControlBypassStore) Revoke(rctx request.CTX, id string, deleteAt int64, deletedBy string) (*model.AccessControlBypass, error) {
	if !model.IsValidId(id) {
		return nil, store.NewErrInvalidInput("AccessControlBypass", "id", id)
	}
	if deletedBy != "" && !model.IsValidId(deletedBy) {
		return nil, store.NewErrInvalidInput("AccessControlBypass", "deletedBy", deletedBy)
	}
	if deleteAt == 0 {
		deleteAt = model.GetMillis()
	}

	query := s.getQueryBuilder().
		Update(accessControlBypassesTable).
		Set("DeleteAt", deleteAt).
		Set("DeletedBy", deletedBy).
		Set("UpdateAt", model.GetMillis()).
		Where(sq.Eq{"Id": id})

	res, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to revoke AccessControlBypass with id=%s", id)
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return nil, errors.Wrap(err, "failed to read RowsAffected on AccessControlBypass revoke")
	}
	if rows == 0 {
		return nil, store.NewErrNotFound("AccessControlBypass", id)
	}

	return s.Get(rctx, id)
}

func (s *SqlAccessControlBypassStore) MarkAccepted(rctx request.CTX, id string, acceptedAt int64, joinedAt int64, membershipCreated bool) (*model.AccessControlBypass, error) {
	if !model.IsValidId(id) {
		return nil, store.NewErrInvalidInput("AccessControlBypass", "id", id)
	}
	if acceptedAt == 0 {
		acceptedAt = model.GetMillis()
	}

	query := s.getQueryBuilder().
		Update(accessControlBypassesTable).
		Set("AcceptedAt", acceptedAt).
		Set("JoinedAt", joinedAt).
		Set("MembershipCreated", membershipCreated).
		Set("UpdateAt", model.GetMillis()).
		Where(sq.Eq{"Id": id})

	res, err := s.GetMaster().ExecBuilder(query)
	if err != nil {
		return nil, errors.Wrapf(err, "failed to mark AccessControlBypass accepted with id=%s", id)
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return nil, errors.Wrap(err, "failed to read RowsAffected on AccessControlBypass accept")
	}
	if rows == 0 {
		return nil, store.NewErrNotFound("AccessControlBypass", id)
	}

	return s.Get(rctx, id)
}

func (s *SqlAccessControlBypassStore) HasActive(_ request.CTX, check model.AccessControlBypassActiveCheck) (bool, error) {
	if check.Now == 0 {
		check.Now = model.GetMillis()
	}

	query := s.getQueryBuilder().
		Select("1").
		From(accessControlBypassesTable).
		Where(sq.Eq{
			"SubjectType":  check.SubjectType,
			"SubjectId":    check.SubjectID,
			"ResourceType": check.ResourceType,
			"ResourceId":   check.ResourceID,
			"Action":       check.Action,
			"DeleteAt":     0,
		}).
		Where(sq.Gt{"ExpiresAt": check.Now}).
		Limit(1)

	var found int
	if err := s.GetReplica().GetBuilder(&found, query); err != nil {
		if err == sql.ErrNoRows {
			return false, nil
		}
		return false, errors.Wrap(err, "failed to check active AccessControlBypass")
	}

	return true, nil
}

func (s *SqlAccessControlBypassStore) DeleteExpiredBatch(_ request.CTX, now int64, limit int) (int64, error) {
	if now == 0 {
		now = model.GetMillis()
	}
	if limit <= 0 {
		return 0, store.NewErrInvalidInput("AccessControlBypass", "limit", limit)
	}

	query := "DELETE FROM AccessControlBypasses WHERE Id = any (array (SELECT Id FROM AccessControlBypasses WHERE ExpiresAt <= ? LIMIT ?))"
	res, err := s.GetMaster().Exec(query, now, limit)
	if err != nil {
		return 0, errors.Wrap(err, "failed to delete expired AccessControlBypasses")
	}

	rows, err := res.RowsAffected()
	if err != nil {
		return 0, errors.Wrap(err, "failed to read RowsAffected on expired AccessControlBypasses delete")
	}

	return rows, nil
}
