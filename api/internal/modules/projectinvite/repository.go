package projectinvite

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/kest-labs/kest/api/internal/modules/member"
	"github.com/kest-labs/kest/api/internal/modules/project"
	"github.com/kest-labs/kest/api/pkg/dbutil"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Repository interface {
	CreateInvitation(ctx context.Context, invitation *ProjectInvitation, tokenHash string) error
	ListInvitationsByProject(ctx context.Context, projectID string) ([]*ProjectInvitation, error)
	GetInvitationByProject(ctx context.Context, projectID, invitationID string) (*ProjectInvitation, error)
	GetInvitationBySlug(ctx context.Context, slug string) (*ProjectInvitation, error)
	UpdateInvitation(ctx context.Context, invitation *ProjectInvitation) error
	GetProjectSummary(ctx context.Context, projectID string) (*ProjectSummary, error)
	AcceptInvitation(ctx context.Context, invitation *ProjectInvitation, userID string, acceptedAt time.Time) error
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) CreateInvitation(ctx context.Context, invitation *ProjectInvitation, tokenHash string) error {
	po := newProjectInvitationPO(invitation, tokenHash)
	if err := r.db.WithContext(ctx).Create(po).Error; err != nil {
		return err
	}

	invitation.ID = po.ID
	invitation.CreatedAt = po.CreatedAt
	invitation.UpdatedAt = po.UpdatedAt
	return nil
}

func (r *repository) ListInvitationsByProject(ctx context.Context, projectID string) ([]*ProjectInvitation, error) {
	var poList []ProjectInvitationPO
	if err := r.db.WithContext(ctx).
		Where("project_id = ?", projectID).
		Order("created_at DESC").
		Find(&poList).Error; err != nil {
		return nil, err
	}

	result := make([]*ProjectInvitation, 0, len(poList))
	for i := range poList {
		result = append(result, poList[i].toDomain())
	}
	return result, nil
}

func (r *repository) GetInvitationByProject(
	ctx context.Context,
	projectID, invitationID string,
) (*ProjectInvitation, error) {
	var po ProjectInvitationPO
	if err := r.db.WithContext(ctx).
		Where("project_id = ? AND id = ?", projectID, invitationID).
		First(&po).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return po.toDomain(), nil
}

func (r *repository) GetInvitationBySlug(ctx context.Context, slug string) (*ProjectInvitation, error) {
	var po ProjectInvitationPO
	if err := r.db.WithContext(ctx).
		Where("slug = ?", slug).
		First(&po).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return po.toDomain(), nil
}

func (r *repository) UpdateInvitation(ctx context.Context, invitation *ProjectInvitation) error {
	po := newProjectInvitationPO(invitation, "")
	return r.db.WithContext(ctx).
		Model(&ProjectInvitationPO{}).
		Where("id = ?", invitation.ID).
		Updates(map[string]any{
			"role":         po.Role,
			"status":       po.Status,
			"max_uses":     po.MaxUses,
			"used_count":   po.UsedCount,
			"expires_at":   po.ExpiresAt,
			"last_used_at": po.LastUsedAt,
			"updated_at":   time.Now().UTC(),
		}).Error
}

func (r *repository) GetProjectSummary(ctx context.Context, projectID string) (*ProjectSummary, error) {
	var po project.ProjectPO
	if err := dbutil.ByID(r.db.WithContext(ctx), projectID).First(&po).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}

	return &ProjectSummary{
		ID:   po.ID,
		Name: po.Name,
		Slug: po.Slug,
	}, nil
}

func (r *repository) AcceptInvitation(
	ctx context.Context,
	invitation *ProjectInvitation,
	userID string,
	acceptedAt time.Time,
) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var po ProjectInvitationPO
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ?", invitation.ID).
			First(&po).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrProjectInvitationNotFound
			}
			return err
		}

		current := po.toDomain()
		if err := validateInvitationCanBeAccepted(current, acceptedAt); err != nil {
			if err == ErrProjectInvitationExpired && current.Status == InvitationStatusActive {
				if updateErr := tx.Model(&ProjectInvitationPO{}).
					Where("id = ?", current.ID).
					Update("status", InvitationStatusExpired).Error; updateErr != nil {
					return updateErr
				}
			}
			return err
		}

		var existing member.ProjectMemberPO
		if err := tx.Where("project_id = ? AND user_id = ?", current.ProjectID, userID).
			First(&existing).Error; err == nil {
			return ErrProjectInvitationAlreadyMember
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		projectMember := &member.ProjectMemberPO{
			ProjectID: current.ProjectID,
			UserID:    userID,
			Role:      current.Role,
		}
		if err := tx.Create(projectMember).Error; err != nil {
			if looksLikeProjectMemberConflict(err) {
				return ErrProjectInvitationAlreadyMember
			}
			return err
		}

		return tx.Model(&ProjectInvitationPO{}).
			Where("id = ?", current.ID).
			Updates(map[string]any{
				"used_count":   gorm.Expr("used_count + ?", 1),
				"last_used_at": acceptedAt,
				"updated_at":   acceptedAt,
			}).Error
	})
}

func looksLikeProjectMemberConflict(err error) bool {
	if err == nil {
		return false
	}

	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "unique") || strings.Contains(msg, "idx_project_user")
}
