/**
 * Swoosh - Easily implemented ajaxed navigation using History API
 *
 * ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~
 *
 * Swoosh is an abstraction of History API implementation with asynchronous
 * loading of page content. Provide a selector for your links and content
 * wrapper, and you have site navigation with URLs, titles and content updating, 
 * but without page reloads.
 *
 * The plugin has many options so that you can enable and disable almost
 * every feature. There is also events for all actions taken during the
 * swooshing process, which means you can hook up on the different stages
 * and, for instace, update your UI accordingly.
 *
 * ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~
 *
 * Features:
 *
 *   - Best things first: you can disable almost everything, and there's an
 *     an event for everything.
 *   - Detect and include internal links in the ajax navigation.
 *   - Provide your own selectors and attributes.
 *   - Auto-replacement of old content to new
 *   - Option to use a default fade in/out animation of content, plus options
 *     for animation duration and delay between fade in and fade out. (This
 *     makes the ajax request wait for the fading out to complete.)
 *   - You can STOP a link that otherwise would be subject for swooshing to
 *     not swoosh by hooking up on the 'swoosh/click' event on the link element
 *     (not the document) and call stopPropagation() on the click event.
 *
 * ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~
 *
 * Dependencies:
 *
 *   - jQuery
 *   - History.js and its jQuery adapter (https://github.com/browserstate/history.js)
 *
 * ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~
 *
 * Good things to know:
 *
 *   - The content wrapper may not be a direct child of the <body> element,
 *     since the ajax response will then know it as a root element.
 *
 * ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~
 *
 * @version 0.3 (2014-02-25)
 * @author Alexander Wallin
 * @url http://alexanderwallin.com
 */


/**
 * Swoosh object.
 *
 * It takes care of all the dirty work, whilst the plugin merely instanciates it.
 */
window.Swoosh = function() {
	return {


		/**
		 * List of event names.
		 */
		events: {
			LINK_CLICKED:  'swoosh/click',
			WILL_FETCH:    'swoosh/willfetch',
			STATE_CHANGED: 'swoosh/statechange',
			DO_FETCH:      'swoosh/dofetch',
			DID_FETCH:     'swoosh/didfetch',
			ERROR_FETCH:   'swoosh/errorfetch',
			DID_REPLACE:   'swoosh/didreplace',
			DID_FADEOUT:   'swoosh/didfadeout',
			DID_FADEIN:    'swoosh/didfadein'
		},


		/**
		 * Default options.
		 */
		defaults: {

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

			// If set, a temporary page title will be set a page fetch
			tempTitleFromAttr:   'data-title'
		},


		/**
		 * The options object. Put here for clarity. Or is it just confusing?
		 * I don't know.
		 */
		options: {},


		/**
		 * XMLHttpRequest object. Represents the latest ajax call, and is aborted
		 * if a new call is made before the current one has finished.
		 */
		//jqxhr: null,
		xhr: null,


		/**
		 * A state object to keep track of when to replace content, and who
		 * should do it.
		 */
		switchingState: {
			newContent:     null,
			isFadedOut:      false,
			isContentLoaded: false
		},


		/**
		 * Initializer
		 */
		init: function(options) {

			// Merge provided options with defaults
			this.options = this._extend(this.defaults, options);

			// Make sure history.js is loaded
			if (!window.History) {
				this._error("Swoosh needs histoy.js to function.");
				return false;
			}
			// Make sure a history.js adapter is loaded
			else if (!window.History.Adapter) {
				this._error("Swoosh needs a history.js adapter to function.");
				return false;
			}
			// Make sure we have a provided baseUrl
			else if (this.options.swooshInternalLinks && !this.options.baseUrl) {
				this._error("In order to auto-swoosh internal links, you need to provide a baseUrl option.");
				return false;
			}

			// Add internal swoosh selector, if told
			if (this.options.swooshInternalLinks) {
				this.options.linkSelector 
					+= (this.options.linkSelector && this.options.linkSelector.length > 0 ? ', ' : '') 
					+  'a[href*="' + this.options.baseUrl + '"]';
			}

			// Store a reference to the content DOM element
			this.contentEl = document.querySelector(this.options.contentSelector);

			// Listen for clicks
			//$(document).on('click', this.options.linkSelector, this.onLinkClick.bind(this));
			document.addEventListener('click', this.onDocClick.bind(this));

			/*
			 * Listen for swooshed clicks, i.e. click events that has not been
			 * stopped using e.stopPropagation().
			 */
			document.addEventListener('swoosh/click', this.handleLinkClick.bind(this));

			/*
			 * onContntReplace handles stuff like flagging internal links,
			 * i.e. things that needs to be done everytime new content has
			 * been fetched and added to the DOM.
			 */
			//$(document).on('swoosh/didreplace', this.onContentReplace.bind(this));

			// Bind state change
			History.Adapter.bind(window, 'statechange', this.onStateChange.bind(this));

			// Enable chaining.
			return this;
		},


		/**
		 * Handles document clicks and checks if the clicked target element
		 * matches the linkSelector option.
		 *
		 * @param    e      Click event
		 */
		onDocClick: function(e) {
			console.log('#onDocClick', e);

			if (!e.target || this._hasClass(e.target, 'no-swoosh'))
				return;

			// Non-swoosh links
			if (!e.target.matches(this.options.linkSelector))
				return;

			/*
			 * Trigger custom event on the link clicked. That way the
			 * event can be stopped using e.stopPropagation(), would the
			 * developer want to do that.
			 *
			 * This plugin listens to this event, but on the document.
			 */
			this._trigger(e.target, 'swoosh/click', {
				'clickEvent': e
			});
		},


		/**
		 * Takes action when a swoosh link has been clicked, and the click event
		 * has bubbled down to the document.
		 *
		 * (The developer may stop the event from bubbling, thus prevent a new
		 * page to be loaded.)
		 *
		 * @param    e             The swoosh click event
		 * @param    clickEvent    The original click event
		 */
		handleLinkClick: function(e) {
			var info = e.detail;

			// We'll send along all the link's attributes, since DOM
			// objects cannot be passed to History.pushState().
			var linkEl   = info.clickEvent.target,
				linkAttr = {};

			for (var i in linkEl.attributes) {
				var attr = linkEl.attributes[i];
				if (attr.specified)
					linkAttr[attr.name] = attr.value;
			};

			// Prevent event from executing its duties
			info.clickEvent.preventDefault();

			// Determine temporary page title
			var tempTitle = this.options.tempTitleFromAttr && linkEl.getAttribute(this.options.tempTitleFromAttr)
				? linkEl.getAttribute(this.options.tempTitleFromAttr)
				: document.title;

			// Push the new state
			History.pushState(
				{
					'linkAttr'           : linkAttr,
					'shouldFetchContent' : true // TODO: change to shouldFetch variable
				},
				tempTitle,
				linkEl.getAttribute('href')
			);
		},


		/**
		 * Handles state changes.
		 */
		onStateChange: function() {

			// Get state
			var state = History.getState();

			console.log('#onStateChange', state);

			// Emit that state has changed
			this._trigger(document, 'swoosh/statechange', { 'state': state });

			// Fetch new content
			if (state.data.shouldFetchContent)
				this.fetchPageContent(state.url);
		},


		/**
		 * Fetches the page at the given URL. The response is handled by
		 * onDidFetchContent().
		 */
		fetchPageContent: function(url) {
			console.log('#fetchPageContent', url);

			// Emit that we're going to fetch new content
			this._trigger(document, 'swoosh/willfetch', { 'url':url });
			document.querySelector('body').classList.add('fetching-page');

			// Abort any ongoing request
			if (this.xhr)
				this.xhr.abort();

			// Create a new request
			this.xhr                    = new XMLHttpRequest();
			this.xhr.onreadystatechange = this.onDidFetchContent.bind(this);
			this.xhr.onerror            = function(error) {
				this._trigger(document, 'swoosh/errorfetch', error);
			}.bind(this);
			this.xhr.responseType       = 'document';
			this.xhr.open('GET', url, true);

			// Send request
			this.xhr.send(null);
		},


		/**
		 * Handles newly loaded content. If the options allow it, it replaces
		 * the content container's children elements with this new content.
		 */
		onDidFetchContent: function(e) {
			console.log('#onDidFetchContent');
			console.log(this.xhr);
			console.log(e);

			if (this.xhr.readyState !== 4)
				return;

			// Store some references
			var responseDom    = this.xhr.responseXML,
				newContent     = responseDom.querySelector(this.options.contentSelector),
				loadedPageName = responseDom.title;
			
			//console.log(responseDom);
			console.log(newContent);
			console.log(loadedPageName);

			// Emit that new content have been fetched
			this._trigger(document, 'swoosh/didfetch', {
				'newContent':   newContent, 
				'pageName':     loadedPageName 
			});

			// Nullify the current request
			this.xhr = null;

			// Set document title
			document.title = loadedPageName;

			// Replace the content if we have consent
			if (this.options.autoreplaceContent) {

				// Replace content immediately
				this.replaceContent(newContent);

				// Emit that new content have been fetched
				this._trigger(document, 'swoosh/didreplace', { 'newContent':newContent, 'pageName':loadedPageName });
			}

			document.querySelector('body').classList.remove('fetching-page');
		},
		
		
		/**
		 * Replaces the content wrap's content and attributes with the
		 * provided corresponding content wrap's ditto.
		 */
		replaceContent: function(newContentWrap, targetContentWrap) {
			targetContentWrap = targetContentWrap || this.contentEl;
			
			// Replace attributes
			for (var i in newContentWrap.attributes) {
				var attr = newContentWrap.attributes[i];
				if (attr.specified)
					targetContentWrap.setAttribute(attr.name, attr.value);
			};
			
			// Replace HTML
			targetContentWrap.innerHTML = newContentWrap.innerHTML;
		},


		/**
		 * Do stuff that should done after every content replace.
		 *
		 * Not implemented right now, but might re-parse share buttons,
		 * trigger a GA page load, or something.
		 */
		onContentReplace: function(e) {},


		/**
		 * Deep merge of two objects.
		 */
		_extend: function(obj1, obj2) {
			for (var property in obj2) {
				if (typeof obj2[property] === "object") {
					obj1[property] = obj1[property] || {};
					arguments.callee(obj1[property], obj2[property]);
				} else {
					obj1[property] = obj2[property];
				}
			}
			return obj1;
		},


		/**
		 * Throws/displays an error.
		 */
		_error: function(msg) {
			if (window.console && console.error)
				console.error(msg);
			else
				alert(msg);
		},


		/**
		 * Triggers an event on a DOM element.
		 */
		_trigger: function(el, eventName, eventInfo) {
			eventInfo = eventInfo || {};
			
			// Create custom event
			var ev = new CustomEvent(eventName, {
				bubbles:    true,
				cancelable: true,
				detail:     eventInfo
			});

			// Dispatch event
			el.dispatchEvent(ev);
		},


		/**
		 * Checks whether an element has a given class.
		 */
		_hasClass: function(el, className) {
			return (' ' + el.className + ' ').indexOf(' ' + className + ' ') > -1;
		}
	};
};


/**
 * Element.matches polyfill.
 *
 * @author Jonathan Neal
 * @url https://gist.github.com/jonathantneal/3062955
 */
this.Element && function(ElementPrototype) {
	ElementPrototype.matchesSelector = ElementPrototype.matchesSelector || 
	ElementPrototype.mozMatchesSelector ||
	ElementPrototype.msMatchesSelector ||
	ElementPrototype.oMatchesSelector ||
	ElementPrototype.webkitMatchesSelector ||
	function (selector) {
		var node = this, nodes = (node.parentNode || node.document).querySelectorAll(selector), i = -1;
 
		while (nodes[++i] && nodes[i] != node);
 
		return !!nodes[i];
	}
}(Element.prototype);


/**
 * CustomEvent polyfill.
 *
 * @url https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent
 */
(function () {
	function CustomEvent ( event, params ) {
		params = params || { bubbles: false, cancelable: false, detail: undefined };
		var evt = document.createEvent( 'CustomEvent' );
		evt.initCustomEvent( event, params.bubbles, params.cancelable, params.detail );
		return evt;
	};

	CustomEvent.prototype = window.Event.prototype;

	window.CustomEvent = CustomEvent;
})();

