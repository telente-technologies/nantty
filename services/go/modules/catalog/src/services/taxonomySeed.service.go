package services

import (
	"context"

	"nantty/modules/catalog/src/container"
	"nantty/modules/catalog/src/generated/ent"
	"nantty/modules/catalog/src/generated/ent/category"
)

var starterTaxonomy = []struct {
	Name     string
	Children []string
}{
	{"Fashion", []string{"Men", "Women", "Kids"}}, {"Shoes", []string{"Sneakers", "Sandals", "Formal"}}, {"Gadgets", []string{"Phones", "Accessories", "Audio"}},
	{"Beauty", []string{"Skincare", "Makeup", "Hair"}}, {"Home & Kitchen", []string{"Furniture", "Cookware", "Decor"}},
	{"Food & Groceries", nil}, {"Kids & Baby", nil}, {"Sports", nil},
}

func SeedStarterTaxonomyWhenEmpty(ctx context.Context, deployed *container.Container) error {
	exists, err := deployed.Client.Category.Query().Where(category.StoreIDIsNil()).Exist(ctx)
	if err != nil || exists {
		return err
	}
	return deployed.RunInTransaction(ctx, func(tx *ent.Tx) error {
		for order, entry := range starterTaxonomy {
			parent, err := tx.Category.Create().SetName(entry.Name).SetSlug(Slugify(entry.Name)).SetSortOrder(order).Save(ctx)
			if err != nil {
				return err
			}
			if _, err := parent.Update().SetPath("/" + parent.ID.String()).Save(ctx); err != nil {
				return err
			}
			for childOrder, name := range entry.Children {
				child, err := tx.Category.Create().SetName(name).SetSlug(Slugify(entry.Name + "-" + name)).SetParentID(parent.ID).SetDepth(1).SetSortOrder(childOrder).Save(ctx)
				if err != nil {
					return err
				}
				if err := child.Update().SetPath("/" + parent.ID.String() + "/" + child.ID.String()).Exec(ctx); err != nil {
					return err
				}
			}
		}
		return nil
	})
}
