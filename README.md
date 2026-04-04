# lightboX
A Vanilla Javascript plugin lightboX  &amp; only 15kb.

不需要任何依赖库的原生JS灯箱Lightbox插件

Language：简体中文 | [English](README-en.md)

## 食用说明

通过 ```<script src=".../lightbox.js"></script>``` 引入。

默认将所有带有```.lightbox-img```类名的图片绑定灯箱，你可以为想要绑定灯箱的图片加上该类。

比如

```html
<img src="image.jpg" class="lightbox-img" alt="...">
```
## 初始化

在页面加载完成后调用（例如 DOMContentLoaded 事件）：
```javascript
document.addEventListener('DOMContentLoaded', function() {
    Lightbox.init(); // 使用默认选择器 '.lightbox-img'
    // 或自定义选择器，例如：
    Lightbox.init('.my-gallery-img');
    // 当然也支持通过DOM来进行访问，例如：
    Lightbox.init('#main-article img'); //为id为main-article内的所有img绑定灯箱
});
```
## 其他函数（可选）

```Lightbox.open(imgElement)``` – 手动打开某张图片

```Lightbox.close()``` – 手动关闭当前灯箱
