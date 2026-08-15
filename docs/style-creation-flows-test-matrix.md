# STDTEX Style Creation Flows Test Matrix

This matrix defines the minimum tests required before connecting the canonical Style model to production UI or data writes.

## Identity

1. Supplier-created Style has `created_by_type = SUPPLIER`.
2. Brand-created Style has `created_by_type = BRAND`.
3. Legacy `negotiation_rows.id` remains stable while the compatibility bridge exists.
4. Supplier reference remains separate from Brand style reference.
5. Fabric reference is preserved on Style detail.

## My Styles

6. Creator company sees its Styles in Created.
7. A user only sees Created Styles for their company, unless Platform Admin.
8. Shared With Us shows relationship-shared styles, not owned styles.
9. Archived shows archived Styles only.
10. Created and Saved remain separate concepts.

## Explore

11. Newly created Supplier Styles do not auto-enter Explore.
12. Published Supplier Styles appear in approved Brand Explore.
13. Brand-created private Styles do not appear in Explore by default.
14. Supplier sharing to a Brand group only exposes Styles to that group.
15. Explore filters do not mutate Collections filters.

## Collections And Canvas

16. Brand collections reference canonical Styles, not duplicated products.
17. Supplier collections remain supplier-owned.
18. Brand collections do not interfere with Supplier collections.
19. Group collections are visible to users in the same group.
20. Canvas uses `linked_style_id` and preserves Style identity.

## RFQ And Negotiation

21. One Brand Style can create one RFQ to many Suppliers.
22. One Supplier can submit a quotation for a Brand RFQ.
23. Multiple Supplier quotations point to the same Brand Style.
24. Awarding one Supplier does not globally close the canonical Style.
25. Closed state is Brand relationship-specific.

## Brand Context And Costing

26. Department is required before Brand costing context is complete.
27. Category is required before Brand costing context is complete.
28. Costing settings resolve through Brand context.
29. Historical costing snapshots remain immutable.
30. Company Admin manages Brand departments, categories, and costing mappings.

## Privacy And Admin

31. Brand A cannot read Brand B private context.
32. Supplier cannot read Brand private costing context.
33. Platform Admin can read all operational data.
34. Company Admin is scoped to their company.
35. Deleting a Style removes only authorized data and never silently deletes unrelated Brand relationships.
