## Summary

Swoosh is an abstraction of History API implementation with asynchronous loading of page content. Provide a selector for your links and content wrapper, and you have site navigation with URLs, titles and content updating, but without page reloads.

The plugin has many options so that you can enable and disable almost
every feature. There is also events for all actions taken during the
swooshing process, which means you can hook up on the different stages
and, for instace, update your UI accordingly.

## Features

* Best things first: you can disable almost everything, and there's an
    an event for everything.
* Detect and include internal links in the ajax navigation.
* Provide your own selectors and attributes.
* Auto-replacement of old content to new
* Option to use a default fade in/out animation of content, plus options for animation duration and delay between fade in and fade out. (This makes the ajax request wait for the fading out to complete.)
* You can STOP a link that otherwise would be subject for swooshing to not swoosh by hooking up on the 'swoosh/click' event on the link element (not the document) and call stopPropagation() on the click event.

## Dependencies

* jQuery
* History.js and its jQuery adapter (https://github.com/browserstate/history.js)

## Good things to know

The content wrapper may not be a direct child of the `<body>` element, since the ajax response will then know it as a root element.

## Changelog

### 0.3

* Passing link element attributes in the state's custom data.

### 0.2

* Improved content replacement
* Fixed bug caused when the `linkSelector` option was empty

### 0.1

Initial version