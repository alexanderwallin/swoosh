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
 * @version 0.2 (2014-02-25)
 * @author Alexander Wallin
 * @url http://alexanderwallin.com
 */
(function($) {


/**
 * Swoosh object.
 *
 * It takes care of all the dirty work, whilst the plugin merely instanciates it.
 */
var Swoosh = function() {
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
		jqxhr: null,


		/**
		 * A state object to keep track of when to replace content, and who
		 * should do it.
		 */
		switchingState: {
			$newContent:         null,
			isFadedOut: false,
			isContentLoaded:     false
		},


		/**
		 * Initializer
		 */
		init: function(options) {

			// Merge provided options with defaults
			this.options = $.extend({}, this.defaults, options);

			// Make sure history.js is loaded
			if (!window.History.Adapter) {
				$.error("Swoosh needs history.js and its jQuery adapter to work charmingly.");
				return false;
			}
			// Make sure we have a provided baseUrl
			else if (this.options.swooshInternalLinks && !this.options.baseUrl) {
				$.error("In order to auto-swoosh internal links, you need to provide a baseUrl option.");
				return false;
			}

			// Store a reference to the content object
			this.$content = $(this.options.contentSelector);

			// Add internal swoosh selector, if told
			if (this.options.swooshInternalLinks) {
				this.options.linkSelector += (this.options.linkSelector && this.options.linkSelector.length > 0 ? ', ' : '') + 'a[href*="' + this.options.baseUrl + '"]';
			}

			// Add loading overlay, if told
			if (this.options.addLoadingOverlay)
				$('body').append($('<div />', { 'class':'page-loading-overlay' }));

			// Listen for clicks
			$(document).on('click', this.options.linkSelector, this.onLinkClick.bind(this));

			/*
			 * Listen for swooshed clicks, i.e. click events that has not been
			 * stopped using e.stopPropagation().
			 */
			$(document).on('swoosh/click', this.handleLinkClick.bind(this));

			/*
			 * onContntReplace handles stuff like flagging internal links,
			 * i.e. things that needs to be done everytime new content has
			 * been fetched and added to the DOM.
			 */
			$(document).on('swoosh/didreplace', this.onContentReplace.bind(this));

			// Bind state change
			History.Adapter.bind(window, 'statechange', this.onStateChange.bind(this));

			// Enable chaining. One row is one row.
			return this;
		},


		/**
		 * Handles clicks on links matching the linkSelector option.
		 */
		onLinkClick: function(e) {

			// Non-swoosh links
			if ($(this).is('.no-swoosh'))
				return;

			/*
			 * Trigger custom event on the link clicked. That way the
			 * event can be stopped using e.stopPropagation(), would the
			 * developer want to do that.
			 *
			 * This plugin listens to this event, but on the document.
			 */
			$(e.target).trigger('swoosh/click', {
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
		handleLinkClick: function(e, info) {
			var $link = $(info.clickEvent.target);

			// Prevent event from executing its duties
			info.clickEvent.preventDefault();

			// Current menu item stuff?

			/* 
			 * TODO:
			 *
			 * Some way for the developer to set whether clicking this link 
			 * should trigger fetching of new content, or merely change the
			 * page title and URL.
			 */
			//var shouldFetch = isContentFetchKindaLink;

			// Determine temporary page title
			var tempTitle = this.options.tempTitleFromAttr && $link.attr(this.options.tempTitleFromAttr)
				? $link.attr(this.options.tempTitleFromAttr)
				: document.title;

			// Push the new state
			History.pushState(
				{
					'shouldFetchContent' : true // TODO: change to shouldFetch variable
				},
				tempTitle,
				$link.attr('href')
			);
		},


		/**
		 * Handles state changes.
		 */
		onStateChange: function() {

			// Get state
			var state = History.getState();

			// Emit that state has changed
			$(document).trigger('swoosh/statechange', { 'state': state });

			// Load new page
			//
			// Hmm, some links may not need new content,
			// just a new URL and title.
			if (state.data.shouldFetchContent) {

				// Abort any ongoing request
				if (this.jqxhr)
					this.jqxhr.abort();

				// Scroll to top
				$('html, body').animate({ 'scrollTop':0 }, this.options.scrollTopDuration);

				// Content switch fade effect
				if (this.options.autoreplaceContent && this.options.fadeContentSwitch) {

					// Reset content switch fading state
					this.switchingState.$newContent     = null;
					this.switchingState.isFadedOut      = false;
					this.switchingState.isContentLoaded = false;

					// Using animat() instead of fadeOut() to avoid glitch when
					// the content element is set to display: none.
					this.$content.stop().animate({ 'opacity':0 }, this.options.fadeContentDuration, function() {
						
						// If content is loaded, fade it in
						$(document).trigger('swoosh/didfadeout');
						this.switchingState.isFadedOut = true;
						this.maybeFadeInContent();

						this.fetchPageContent(state.url);
					}.bind(this));
				}
				else {

					// Fetch immediatley
					this.fetchPageContent(state.url);
				}
			}
		},


		/**
		 * Fetches the page at the given URL. The response is handled by
		 * onDidFetchContent().
		 */
		fetchPageContent: function(url) {

			// Emit that we're going to fetch new content
			$(document).trigger('swoosh/willfetch', { 'url':url });
			$('html').addClass('fetching-page');

			// Abort any ongoing request
			if (this.jqxhr)
				this.jqxhr.abort();

			// Fetch new content
			this.jqxhr = $.ajax({
				type:    'get',
				url:     url,
				cache:   this.options.ajaxCache,
				success: this.onDidFetchContent.bind(this),
				error: function(error) {
					$(document).trigger('swoosh/errorfetch', error);
				}
			});
		},


		/**
		 * Handles newly loaded content. If the options allow it, it replaces
		 * the content container's children elements with this new content.
		 */
		onDidFetchContent: function(response) {

			// Store some references
			var $response = $(response),
				$newContent    = $response.find(this.options.contentSelector),
				loadedPageName = $newContent.attr(this.options.pageNameAttr);

			// Nullify the current request
			this.jqxhr = null;

			// Emit that new content have been fetched
			$(document).trigger('swoosh/didfetch', { '$newContent':$newContent, 'response':response, 'pageName':loadedPageName });
			$('html').removeClass('fetching-page');

			// Set document title
			document.title = $response.filter('title').text();

			// Replace the content if we have consent
			if (this.options.autoreplaceContent) {

				// Content switch fade
				if (this.options.fadeContentSwitch) {

					// Fade in if the content has been fully faded out
					this.switchingState.$newContent     = $newContent;
					this.switchingState.isContentLoaded = true;
					this.maybeFadeInContent();
				}
				else {
				
					// Replace content immediately
					this.replaceContent($newContent);

					// Emit that new content have been fetched
					$(document).trigger('swoosh/didreplace', { '$newContent':$newContent, 'response':response, 'pageName':loadedPageName });
				}
			}
		},


		/**
		 * Fades in the content element if:
		 *
		 *    1. the new content has been loaded; and
		 *    2. the previous content has been faded out.
		 */
		maybeFadeInContent: function() {
			if (this.switchingState.isFadedOut && this.switchingState.isContentLoaded) {

				// Replace content
				this.replaceContent(this.switchingState.$newContent);

				// Continue with the animation
				setTimeout(function() {

					// Fade in
					this.$content.stop().animate({ 'opacity':1 }, this.options.fadeContentDuration, function() {

						// Notify about fade in
						this.switchingState.isFadedOut = false;
						$(document).trigger('swoosh/didfadein');
					}.bind(this));

					// Emit that new content have been fetched
					$(document).trigger('swoosh/didreplace', { '$newContent':this.switchingState.$newContent, 'pageName':this.switchingState.$newContent.attr('data-page') });

					// Reset state
					this.switchingState.$newContent     = null;
					this.switchingState.isContentLoaded = false;
				}.bind(this), this.options.fadeContentDelay);
			}
		},
		
		
		/**
		 * Replaces the content wrap's content and attributes with the
		 * provided corresponding content wrap's ditto.
		 */
		replaceContent: function($newContentWrap, $targetContentWrap) {
			$targetContentWrap = $targetContentWrap || this.$content;
			
			// Replace attributes
			$.each($newContentWrap[0].attributes, function() {
				if (this.specified)
					$targetContentWrap.attr(this.name, this.value);
			});
			
			// Replace HTML
			$targetContentWrap.html($newContentWrap.html());
		},


		/**
		 * Do stuff that should done after every content replace.
		 *
		 * Not implemented right now, but might re-parse share buttons,
		 * trigger a GA page load, or something.
		 */
		onContentReplace: function(e) {}
	};
};


/**
 * Plugin wrap for the Swoosh object.
 */
$.swoosh = function(options) {

	// We only need to instantiate it once.
	if (!$.swooshInstance) {
	
		// Create a Swoosh instance
		this.swooshInstance = new Swoosh().init(options);

		return this;
	}

};

})(jQuery);