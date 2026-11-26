# iCoFyz cart and wishlist

The storefront product cards now include:
- Heart buttons to add/remove products from a wishlist.
- Add to cart buttons with a visible added state.
- Header Wishlist and Cart controls with item counts.
- Slide-in style panels for viewing/removing saved items.
- Cart and wishlist persistence in the browser using localStorage.

These are front-end shopping-list interactions. Checkout currently routes visitors to the existing sign-up/login flow; this does not create orders, calculate wholesale prices, process payments, or sync carts across devices. Those require authenticated customer APIs and order/payment integration.
