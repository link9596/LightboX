# lightboX

A native JS lightbox plugin that doesn't require any dependent libraries & only 15kb.

Language: [简体中文](README.md) | English

## Instructions

Include it via `<script src=".../lightbox.js"></script>`

By default, all images with the class name ```.lightbox-img``` will be bound to a lightbox. You can add this class to any image you want to bind to a lightbox.
for example:

```html
<img src="image.jpg" class="lightbox-img" alt="...">
```

## Initialization

Call after the page has loaded (e.g. DOMContentLoaded event):

```javascript
document.addEventListener('DOMContentLoaded', function() {
    Lightbox.init(); // Use the default selector '.lightbox-img'
    // Or a custom selector, for example:
    Lightbox.init('.my-gallery-img');
    // Of course, it also supports access through DOM, for example:
    Lightbox.init('#main-article img'); //Bind lightbox to all img elements within the container with id 'main-article'
});
```
## Other functions (optional)
```Lightbox.open(imgElement)``` – Manually open a specific image

```Lightbox.close()``` – Manually close the current lightbox
