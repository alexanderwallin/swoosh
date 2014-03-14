## Summary

Swoosh is an abstraction of History API implementation with asynchronous loading of page content. Provide a selector for your links and content wrapper, and swoosh! your site has HTML5 pushstate navigation with URLs, titles and content updating, without any page reloads.

The plugin has many options so that you can enable and disable almost every feature. There is also events for all actions taken during the swooshing process, which means you can hook up on the different stages and, for instace, update your UI accordingly.

## Features

* Best things first: you can disable almost everything, and there's an an event for everything.
* Detect and include internal links in the ajax navigation.
* Provide your own selectors and attributes.
* Optional auto-replacement of old content to new.
* Optional default fade in/out animation of content, plus options for animation duration and delay between fade in and fade out. (This makes the ajax request wait for the fading out to complete.)
* You can **stop** a link that otherwise would be subject for swooshing to not swoosh by hooking up on the *swoosh/click* event on the link element (not the document) and call `stopPropagation()` on the click event.

## Using Swoosh

### Examples

	// Default swooshing, with content being fetched and
	// replaced (fade in/out) automatically.
	$.swoosh({
		linkSelector:    '#nav a',
		contentSelector: '#content'
	});

### Options

	{

		// The site's root URL
		baseUrl:             null,

		// Selector for the container of the inter-switchable content.
		contentSelector:     '#content',

		// The attribute from which a fetched page's content will be
		// identified.
		pageNameAttr:        'data-page',

		// Selector specifying which links that should trigger an 
		// asynchronous page fetch
		linkSelector:        '#nav a',

		// Whether to automatically detect internal links and swoosh them.
		swooshInternalLinks: false,

		// Whether to autoreplace old content with new
		autoreplaceContent:  true,

		// Whether to use jQuery's ajax cache
		ajaxCache:           true,

		// Whether to add a loading overlay element to the DOM
		addLoadingIndicator: false,

		// If set, a temporary page title will be set a page fetch
		tempTitleFromAttr:   'data-title',

		// The duration of the scroll to the top
		scrollTopDuration:   300,

		// Whether to use the preset content fading
		fadeContentSwitch:   true,

		// The duration of the content fade effect
		fadeContentDuration: 300,

		// A delay between fading content in and out
		fadeContentDelay:    100
	}

### Events

*swoosh/click*   
A swooshed link is clicked.

*swoosh/statechange*
Triggered when a *statechange* event is triggered. Here you have the ability to stop Swoosh from fetching content by settings `state.data.shouldFetchContent = false;`.

*swoosh/willfetch*
A new page's content is about to be fetched.

*swoosh/didfetch*
New content was fetched.

*swoosh/errorfetch*
An error occurred fetching new content.

*swoosh/didreplace*
Swoosh did replace the page's main content with new content.

*swoosh/didfadeout*
The content wrapper did fade out.

*swoosh/didfadein*
The content wrapper did fade in.

## Dependencies

* jQuery
* History.js and its jQuery adapter (https://github.com/browserstate/history.js)

## Good things to know

The content wrapper may not be a direct child of the `<body>` element, since the ajax response will then know it as a root element.

## Changelog

#### 0.3

* Passing link element attributes in the state's custom data.

#### 0.2

* Improved content replacement
* Fixed bug caused when the `linkSelector` option was empty

#### 0.1

Initial version