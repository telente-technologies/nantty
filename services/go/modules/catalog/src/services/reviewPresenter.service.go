package services

import (
	"context"

	"github.com/google/uuid"

	"zudomart/modules/catalog/src/container"
	"zudomart/modules/catalog/src/generated/ent"
	"zudomart/modules/catalog/src/generated/ent/predicate"
	"zudomart/modules/catalog/src/generated/ent/product"
	"zudomart/modules/catalog/src/types"
)

func replyViewOf(row *ent.Review) *types.ReviewReplyView {
	if row.ReplyBody == nil || row.ReplyCreatedAt == nil {
		return nil
	}
	name := ""
	if row.ReplyAuthorName != nil {
		name = *row.ReplyAuthorName
	}
	return &types.ReviewReplyView{Body: *row.ReplyBody, AuthorName: name, CreatedAt: *row.ReplyCreatedAt, UpdatedAt: row.ReplyUpdatedAt}
}

func ReviewAuthors(ctx context.Context, deployed *container.Container, reviews []*ent.Review) map[uuid.UUID]types.ReviewAuthorView {
	identifiers := UniqueIdentifiers(reviews, func(row *ent.Review) uuid.UUID { return row.AuthorAccountID })
	profiles, _ := deployed.Users.PersonalProfilesByAccount(ctx, identifiers)
	authors := map[uuid.UUID]types.ReviewAuthorView{}
	for _, identifier := range identifiers {
		profile := profiles[identifier]
		author := types.ReviewAuthorView{Id: identifier.String(), Name: profile.Name, Username: profile.Handle}
		if profile.AvatarUrl != "" {
			author.AvatarUrl = &profile.AvatarUrl
		}
		authors[identifier] = author
	}
	return authors
}

func PublicReviewViews(ctx context.Context, deployed *container.Container, reviews []*ent.Review) []types.PublicReviewView {
	authors := ReviewAuthors(ctx, deployed, reviews)
	views := make([]types.PublicReviewView, 0, len(reviews))
	for _, row := range reviews {
		views = append(views, types.PublicReviewView{
			Id: row.ID.String(), Author: authors[row.AuthorAccountID], Rating: row.Rating, Text: row.Body, Title: row.Title,
			IsVerifiedPurchase: row.VerifiedPurchase, Reply: replyViewOf(row), CreatedAt: row.CreatedAt,
		})
	}
	return views
}

func SellerReviewViews(ctx context.Context, deployed *container.Container, reviews []*ent.Review) ([]types.SellerReviewView, error) {
	authors := ReviewAuthors(ctx, deployed, reviews)
	products := map[uuid.UUID]*types.SellerReviewProductView{}
	productIds := []uuid.UUID{}
	for _, row := range reviews {
		if row.ProductID != nil {
			productIds = append(productIds, *row.ProductID)
		}
	}
	rows, err := deployed.Client.Product.Query().Where(productIdIn(productIds)).All(ctx)
	if err != nil {
		return nil, err
	}
	summaries, err := LoadProductSummaries(ctx, deployed, rows, nil)
	if err != nil {
		return nil, err
	}
	for index, row := range rows {
		products[row.ID] = &types.SellerReviewProductView{Id: row.ID.String(), Name: row.Name, ImageUrl: summaries[index].ImageUrl}
	}
	views := make([]types.SellerReviewView, 0, len(reviews))
	for _, row := range reviews {
		view := types.SellerReviewView{
			Id: row.ID.String(), Kind: row.Kind, Rating: row.Rating, Title: row.Title, Body: row.Body, Author: authors[row.AuthorAccountID], OrderNumber: row.OrderNumber,
			IsVerifiedPurchase: row.VerifiedPurchase, PhotoCount: row.PhotoCount, HelpfulCount: row.HelpfulCount, Status: row.Status, Reply: replyViewOf(row), CreatedAt: row.CreatedAt,
		}
		if row.ProductID != nil {
			view.Product = products[*row.ProductID]
		}
		views = append(views, view)
	}
	return views, nil
}

func productIdIn(identifiers []uuid.UUID) predicate.Product { return product.IDIn(identifiers...) }
