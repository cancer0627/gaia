/* globals BaseUI, CardsHelper, Tagged, TrustedUIManager */

/* exported Card */

'use strict';

(function(exports) {

  var _id = 0;

  /**
   * A card in a card view, representing a single app
   *
   * @class Card
   * @param {Object} config config to associate the card with a given app and
   *                        how it should be displayed
   * @extends BaseUI
   */
  function Card(config) {
    if (config) {
      for (var key in config) {
        this[key] = config[key];
      }
    }

    this.instanceID = _id++;

    return this;
  }

  Card.prototype = Object.create(BaseUI.prototype);
  Card.prototype.constructor = Card;

  /**
   * @type {String}
   * @memberof Card.prototype
   */
  Card.prototype.EVENT_PREFIX = 'card-';

  /**
   * How much to scale the current card
   * @type {Float}
   * @memberof Card.prototype
   */
  Card.prototype.SCALE_FACTOR = 0.8;

  /**
   * How much to scale card when not the current card
   * @type {Float}
   * @memberof Card.prototype
   */
  Card.prototype.SIBLING_SCALE_FACTOR = 0.6;

  /**
   * Opacity to apply when not the current card
   * @type {Float}
   * @memberof Card.prototype
   */
  Card.prototype.SIBLING_OPACITY = 0.4;

  /**
   * Transition to apply when moving the card
   * @type {String}
   * @memberof Card.prototype
   */
  Card.prototype.MOVE_TRANSITION = '-moz-transform .3s, opacity .3s';

  /**
   * The instance's element will get appended here if defined
   * @type {DOMNode}
   * @memberof Card.prototype
   */
  Card.prototype.containerElement = null;

  Card.prototype.CLASS_NAME = 'Card';
  Card.prototype.element = null;

  /**
   * Debugging helper to output a useful string representation of an instance.
   * @memberOf Card.prototype
  */
  Card.prototype.toString = function() {
    return '[' + this.CLASS_NAME + ' ' +
            this.position + ':' + this.title + ']';
  };

  /**
   * Get cached setting boolean value for whether to use screenshots or
   * icons in cards
   * @memberOf Card.prototype
   */
  Card.prototype.getScreenshotPreviewsSetting = function() {
    return this.manager.useAppScreenshotPreviews;
  };

  /**
   * Template string representing the innerHTML of the instance's element
   * @memberOf Card.prototype
   */
  Card.prototype.template = function() {
    // fix a jshint issue with tagged template strings
    // https://github.com/jshint/jshint/issues/2000
    /* jshint -W033 */
    return Tagged.escapeHTML `<div data-l10n-id="closeCard" class="close-card"
     role="button" style="visibility: ${this.closeButtonVisibility}"></div>
    <div class="screenshotView" data-l10n-id="openCard" role="button"></div>
    <div class="appIconView" style="background-image:${this.iconValue}"></div>
    <div class="titles">
    <h1 id="${this.titleId}" class="title">${this.title}</h1>
    <p class="subtitle">${this.subTitle}</p>
    </div>`;
    /* jshint +W033 */
  };

  /**
   * Card html view - builds the innerHTML for a card element
   * @memberOf Card.prototype
   */
  Card.prototype.view = function c_view() {
    return this.template();
  };

  /**
   * Populate properties on the instance before templating
   * @memberOf Card.prototype
   */
  Card.prototype._populateViewData = function() {
    var app = this.app;
    this.title = (app.isBrowser() && app.title) ? app.title : app.name;
    this.subTitle = '';
    this.iconValue = 'none';
    this.closeButtonVisibility = 'visible';
    this.viewClassList = ['card', 'appIconPreview'];
    this.titleId = 'card-title-' + this.instanceID;

    // app icon overlays screenshot by default
    // and will be removed if/when we display the screenshot
    var iconURI = CardsHelper.getIconURIForApp(this.app);
    if (iconURI) {
        this.iconValue = 'url(' + iconURI + ')';
    }

    var origin = app.origin;
    var popupFrame;
    var frameForScreenshot = app.getFrameForScreenshot();

    if (frameForScreenshot &&
        CardsHelper.getOffOrigin(frameForScreenshot.src, origin)) {
      this.subTitle = CardsHelper.getOffOrigin(
                        frameForScreenshot.src, origin);
    }
    // XXX do we still need?
    //  this.viewClassList.push('popup');

    if (TrustedUIManager.hasTrustedUI(app.origin)) {
      popupFrame = TrustedUIManager.getDialogFromOrigin(app.origin);
      this.title = CardsHelper.escapeHTML(popupFrame.name || '', true);
      this.viewClassList.push('trustedui');
    } else if (!this.app.killable()) {
      // unclosable app
      this.closeButtonVisibility = 'hidden';
    }
  };

  /**
   * Build a card representation of an app window.
   * @memberOf Card.prototype
   */
  Card.prototype.render = function() {
    this.publish('willrender');

    var elem = this.element || (this.element = document.createElement('li'));
    // we maintain position value on the instance and on the element.dataset
    elem.dataset.position = this.position;
    // we maintain instanceId on the card for unambiguous lookup
    elem.dataset.appInstanceId = this.app.instanceID;
    // keeping origin simplifies ui testing
    elem.dataset.origin = this.app.origin;

    this._populateViewData();

    // populate the view
    elem.innerHTML = this.view();

    // Label the card by title (for screen reader).
    elem.setAttribute('aria-labelledby', this.titleId);

    this.viewClassList.forEach(function(cls) {
      elem.classList.add(cls);
    });

    if (this.containerElement) {
      this.containerElement.appendChild(elem);
    }

    this._fetchElements();
    this._registerEvents();
    this.publish('rendered');
    return elem;
  };

  /**
   * Batch apply style properties
   * @param {Object} nameValues object with style property names as keys
   *                            and values to apply to the card
   * @memberOf Card.prototype
   */
  Card.prototype.applyStyle = function(nameValues) {
    var style = this.element.style;
    for (var property in nameValues) {
      if (undefined === nameValues[property]) {
        delete style[[property]];
      } else {
        style[property] = nameValues[property];
      }
    }
  };

  /**
   * Set card's screen reader visibility.
   * @type {Boolean} A flag indicating if it should be visible to the screen
   * reader.
   * @memberOf Card.prototype
   */
  Card.prototype.setVisibleForScreenReader = function(visible) {
    this.element.setAttribute('aria-hidden', !visible);
  };

  /**
   * Call kill on the appWindow
   * @memberOf Card.prototype
   */
  Card.prototype.killApp = function() {
    this.app.kill();
  };

  /**
   * tear down and destroy the card
   * @memberOf Card.prototype
   */
  Card.prototype.destroy = function() {
    this.publish('willdestroy');
    var element = this.element;
    if (element) {
      this._unregisterEvents();
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }
    this.element = this.manager = this.app = null;
    this.publish('destroyed');
  };

  /**
   * Default event handler
   * @param  {DOMEvent} evt The event.
   * @memberOf Card.prototype
   */
  Card.prototype.handleEvent = function(event) {
    switch (event.type) {
      case 'outviewport':
        this.onOutViewport(event);
        break;
      case 'onviewport':
        this.onViewport(event);
        break;
    }
  };

  /**
   * Handle the card no longer being visible in the viewport
   * @memberOf Card.prototype
   * @param  {DOMEvent} evt The event.
   */
  Card.prototype.onOutViewport = function c_onOutViewport(event) {
    this.element.style.display = 'none';
  };

  /**
   * Update display of card when it enters the viewport
   * @memberOf Card.prototype
   * @param  {DOMEvent} evt The event.
   */
  Card.prototype.onViewport = function c_onViewport(event) {
    var elem = this.element;
    var screenshotView = this.screenshotView;
    var app = this.app;
    elem.style.display = 'block';

    var isIconPreview = !this.getScreenshotPreviewsSetting();
    if (isIconPreview) {
      elem.classList.add('appIconPreview');
    } else {
      elem.classList.remove('appIconPreview');
      if (screenshotView.style.backgroundImage) {
        return;
      }
    }

    // Handling cards in different orientations
    var degree = app.rotatingDegree;
    var isLandscape = (degree == 90 || degree == 270);

    // Rotate screenshotView if needed
    screenshotView.classList.add('rotate-' + degree);

    if (isIconPreview) {
      return;
    }

    if (isLandscape) {
      // We must exchange width and height if it's landscape mode
      var width = elem.clientHeight;
      var height = elem.clientWidth;
      screenshotView.style.width = width + 'px';
      screenshotView.style.height = height + 'px';
      screenshotView.style.left = ((height - width) / 2) + 'px';
      screenshotView.style.top = ((width - height) / 2) + 'px';
    }

    // Local helper function used both for immediate and callback.
    function setScreenshotBackground() {
      var cachedLayer = app.requestScreenshotURL();
      if (!cachedLayer) {
        return false;
      }
      screenshotView.style.backgroundImage = 'url(' + cachedLayer + ')';
      return true;
    }


    //
    // We used to try and forcibly refresh the screenshot for the current
    // active application, this is absolutely not necessary anymore as the
    // app window itself will always have a fresh screenshot for use as
    // we transition from displaying the app to displaying the cards view.
    //
    // However still do it in *one* case... Browser Windows! These windows only
    // have a screenshot when the page is completed loading which can take a
    // little bit and leave the user with a blank screenshot until they drag
    // the card around.
    //
    // The underlying mozbrowser element waits for the content to be loaded
    // before actually taking the screenshot and invoking the callback.
    //

    // If we have a cached screenshot, use that first
    if (setScreenshotBackground()) {
      // We had one or this is not a browser window, we're done here.
      return;
    }

    app.getScreenshot(function gotScreenshot() {
      setScreenshotBackground();
    });
  };

  /**
   * Register event listeners. Most events are registered and handled in
   * the TaskManager
   * @memberOf Card.prototype
  */
  Card.prototype._registerEvents = function c__registerEvents() {
    var elem = this.element;
    if (elem === null) {
      return;
    }
    elem.addEventListener('outviewport', this);
    elem.addEventListener('onviewport', this);
  };

  /**
   * Un-register event listeners
   * @memberOf Card.prototype
  */
  Card.prototype._unregisterEvents = function c__registerEvents() {
    var elem = this.element;
    if (elem === null) {
      return;
    }
    elem.removeEventListener('outviewport', this);
    elem.removeEventListener('onviewport', this);
  };

  Card.prototype._fetchElements = function c__fetchElements() {
    this.screenshotView = this.element.querySelector('.screenshotView');
    this.titleNode = this.element.querySelector('h1.title');
  };


  return (exports.Card = Card);

})(window);

