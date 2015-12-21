/*!
 * Bootstrap Classify 2 | JavaScript Classification Marking Tool



 */

/*jslint browser: true, devel: true, nomen: true, unparam: true, white: true */
/*global _, $, jQuery*/

/**
 * TO DO / KNOWN ISSUES
 * - HSC-P -> auto-selects NF -> select XD/ND -> unselect XD -> NF becomes active but unselectable which should not be allowed, as HCS-P still requires NF
 * Not a huge issue as the NF still remains in the in the markings behind the scenes but there is a disconnect with the interface
 */

if (typeof jQuery === 'undefined') {
  throw new Error('Bootstrap Classify requires jQuery');
}

if (typeof _ === 'undefined') {
  throw new Error('Bootstrap Classify requires Underscore.js');
}

if (typeof ism === 'undefined') {
  throw new Error('Bootstrap Classify requires ISM.js');
}


(function ($, window, document, undefined) {

  'use strict';

  var Classify = function (element, options) {
    this.element = element;
    this.$element = $(element);
    this.options = options;
    this.errors	= [];
    this.warnings = [];
    this.ism = {};
    this.id = _.uniqueId('bsc');
    this.tpl = $.fn.classify.templates;
    this.conf = $.extend(true, {}, window.ISMConfig);
    _.extend(this.conf.classification, $.fn.classify.markings.classification);
    this.init();
  };

  Classify.VERSION = '2.0.14';

  Classify.DEFAULTS = {
    classification: ['TS'],			// {array|string} <U|C|S|TS> classification
    scicontrols: [], 						// {array|string} SCI Controls
    disseminationcontrols: [],	// {array|string} Dissemination Controls
    nonicmarkings: [],					// {array|string} Non-IC Dissemination Controls
    releasableto: [], 					// {array|string} Releasable To tri/tetragraphs
    ownerproducer: ['USA'],			// {array|string} OwnerProducer trigraphs
    fgisourceopen: [],					// {array|string} FGI Open Sources
    fgisourceprotected: [],			// {array|string} <FGI|''>
    trigraphs: ['AUS','CAN','GBR','NZL'],	// {array} list of trigraphs to show by default
    tetragraphs: ['TEYE','ACGU','FVEY','NATO'], // {array} list of tetragraphs to show by default
    btnsize: 'xs',		// {string} <xs|sm|lg> Bootstrap button size class
    format: 'pm',			// {string} <pm|bl> render classification marking as Portion Mark or Banner Line
    mode: 'popover',	// {string} <popover|modal>
    fdr: true, 				// {boolean} enforce FD&R markings, i.e. prohibits straight classifications
    fgi: true,				// {boolean} enable FGI markings
    nonic: true,			// {boolean} enable Non-IC markings
    relto: true,			// {boolean} enable Rel To markings
    headings: true,		// {boolean} show table headings
    update: true,			// {boolean} update element text/input value on save?
    input: false,			// {boolean} use input/text value from element as marking
    callback: false,	// {function|false} callback to receive selected classification values
    without: false,		// {array|false} control markings to remove from configuration
    selector: false,	// {string|false} like the Bootstrap Popover `selector` option, for dynamic initialization
    title: '',				// {string} Popover/Modal title (leave empty to disable title)
    container: false, // {string|false} For popovers: See Bootstrap Popover docs
    viewport: { selector: 'body', padding: 0 } // {string|object} option to pass to Popover options
  };


  Classify.prototype = {

    init: function () {

      this.format = this.options.format === 'bl' ? 'bl' : 'pm';
      this.classLabels = _.pluck(this.conf.classification, 'label').join(' ');
      this.isInput = this.$element.prop('tagName') === 'INPUT' ? true : false;

      if (this.options.without) {
	this.without(this.options.without);
      }

      if (this.options.input) {
	if (this.isInput && this.$element.val().length) {
	  this.marking = this.$element.val();
	} else {
	  this.marking = this.$element.text() || '';
	}
	this.ism = ism(this.marking, { format: this.format });
      } else {
	var data = _.pick(this.options, this.conf.keys);
	this.ism = ism(data, { format: this.format });
      }

      console.log(this);

      this.typeahead = {
	mode: undefined,
	data: [],
	relto: {
	  label: 'Rel To',
	  enabled: this.options.relto,
	  active: this.hasDissem('REL')
	},
	fgi: {
	  label: 'FGI',
	  enabled: this.options.fgi,
	  active: this.showFGI()
	}
      };

      if (this.$element.length) {
	if (this.options.mode === 'modal') {
	  this.initModal();
	} else {
	  this.initPopover();
	}
      }
    },

    initModal: function () {
      this.$element.on('click', function () {

	// if not initialized yet render the modal and the component
	if (!this.$modal) {

	  // insert the modal template into the DOM
	  this.$element.after(this.tpl.modal({
	    id: this.id,
	    title: this.options.title
	  }));

	  this.$modal = $('#' + this.id);
	  this.$classify = this.$modal.find('.bs-classify');

	  this.initTemplate();
	  this.render();
	}

	this.$modal.modal('show');
      }.bind(this));
    },

    initPopover: function () {
      this.$element.popover({
	container: this.options.container,
	content: '<div class="bs-classify"></div>',
	delay: 0,
	html: true,
	template: this.tpl.popover,
	title: this.options.title,
	viewport: this.options.viewport
      }).on('show.bs.popover', function (e) {

	if (this.options.selector) {
	  // if plugin was init'd dynamically with a selector argument then hide other popovers
	  $(this.options.selector).not(e.target).popover('hide');
	}

	// defer rendering until popover has finished rendering its content
	// this seems to be fast than using the `shown.bs.popover` event
	_.defer(function () {
	  this.popover = $(e.target).data('bs.popover');
	  this.$classify = this.popover.$tip.find('.bs-classify');
	  this.initTemplate();
	  this.render();
	}.bind(this));

      }.bind(this));
    },


    initTemplate: function () {
      this.$container = $(this.tpl.main);
      this.$classify.html(this.$container);

      this.$banner = this.$classify.find('.label');
      this.$error	= this.$classify.find('.alert');

      this.$table	= this.$classify.find('table');
      this.$headings = this.$classify.find('thead');

      this.$colfgi = this.$classify.find('.bsc-colfgi');
      this.$colsci = this.$classify.find('.bsc-colsci');
      this.$colnonic = this.$classify.find('.bsc-colnonic');
      this.$colrelto = this.$classify.find('.bsc-colrelto');

      this.$classif = this.$classify.find('.bsc-classification');
      this.$fgi	= this.$classify.find('.bsc-fgi');
      this.$sci	= this.$classify.find('.bsc-scicontrols');
      this.$dissem = this.$classify.find('.bsc-disseminationcontrols');
      this.$nonic = this.$classify.find('.bsc-nonicmarkings');
      this.$relto = this.$classify.find('.bsc-relto');

      this.$trigraphs = this.$classify.find('.bsc-trigraphs');
      this.$tetragraphs = this.$classify.find('.bsc-tetragraphs');
      this.$typeahead = this.$classify.find('.bsc-typeahead');
      this.$typemenu = this.$classify.find('.bsc-typemenu');
      this.$savebtn	= this.$classify.find('.bsc-save');

      this.$resetGroups = this.$classify.find('.btn-group-vertical:not(.bsc-classification)');
      this.$buttonGroups = this.$classify.find('.btn-group-vertical');

      this.$savebtn.on('click', $.proxy(this.save, this));
      this.$buttonGroups.on('click', '.btn', $.proxy(this.buttonHandler, this));
      this.$typeahead.on('click', 'a', $.proxy(this.inputHandler, this));
    },


    /*!
     * Intitializes each control group and renders the template
     */
    render: function (cb) {
      this.initClassification();
      this.initSCI();
      this.initDissem();

      if (this.options.headings) {
	this.$headings.show();
      }

      if (this.options.nonic) {
	this.initNonIC();
      }

      if (this.options.fgi) {
	this.initFGI();
      }

      if (this.options.relto) {
	this.initTrigraphs();
	this.initTetragraphs();
	this.initRelto();
      }

      if (this.options.fgi || this.options.relto) {
	this.initTypeaheadData();
      }

      this.updateClassification(true);
    },


    initClassification: function () {
      var buffer = [], active, compiled;

      _.each(this.conf.classification, function (obj, key) {
	active = key === this.getClassification() ? 'active' : '';
	compiled = this.tpl.radio({ name: 'classification', id: key, label: key, title: obj.bl, css: obj.css+' '+active, size: this.options.btnsize });
	buffer.push(compiled);
      }, this);

      this.$classif.append(buffer);
    },


    initSCI: function () {
      var buffer = [], active, compiled;

      _.each(this.conf.scicontrols, function (obj, key) {
	active = _.contains(this.get('scicontrols'), key) ? 'active' : '';
	compiled = this.tpl.checkbox({ name: 'scicontrols', id: key, label: key, title: obj.bl, css: active, size: this.options.btnsize });
	buffer.push(compiled);
      }, this);

      this.$sci.append(buffer);
    },


    initDissem: function () {
      var buffer = [], active, compiled;

      _.each(this.conf.disseminationcontrols, function (obj, key) {
	active = _.contains(this.get('disseminationcontrols'), key) ? 'active' : '';
	if ((key === 'REL' && this.options.relto) || key !== 'REL') {
	  compiled = this.tpl.checkbox({ name: 'disseminationcontrols', id: key, label: obj.pm, title: obj.bl, css: active, size: this.options.btnsize });
	  buffer.push(compiled);
	}
      }, this);

      this.$dissem.append(buffer);
    },


    initNonIC: function () {
      var buffer = [], active, compiled;

      _.each(this.conf.nonicmarkings, function (obj, key) {
	active = _.contains(this.get('nonicmarkings'), key) ? 'active' : '';
	compiled = this.tpl.checkbox({ name: 'nonicmarkings', id: key, label: obj.pm, title: obj.bl, css: active, size: this.options.btnsize });
	buffer.push(compiled);
      }, this);

      this.$nonic.append(buffer);
    },


    initTrigraphs: function () {
      var buffer = [], active, compiled;

      _.each(this.conf.trigraphs, function (value, key) {
	if (_.contains(this.options.trigraphs, key)) {
	  active = _.contains(this.get('releasableto'), key) ? 'active' : '';
	  compiled = this.tpl.checkbox({ name: 'releasableto', id: key, label: key, title: value[0], css: active, size: this.options.btnsize });
	  buffer.push(compiled);
	}
      }, this);

      this.$trigraphs.append(buffer);
    },


    initTetragraphs: function () {
      var buffer = [], active, compiled;

      _.each(this.conf.tetragraphs, function (value, key) {
	if (_.contains(this.options.tetragraphs, key)) {
	  active = _.contains(this.get('releasableto'), key) ? 'active' : '';
	  compiled = this.tpl.checkbox({ name: 'releasableto', id: key, label: key, title: value[0], css: active, size: this.options.btnsize });
	  buffer.push(compiled);
	}
      }, this);

      this.$tetragraphs.append(buffer);
    },


    initRelto: function () {
      var group, list, active, compiled, item, $control;

      // find relto items that do not have a button and create one
      _.each(this.get('releasableto'), function (id) {
	if (!this.$relto.find('.btn-' + id).length && id !== 'USA') {

	  group = (id.length > 3) ? 'tetragraphs' : 'trigraphs';
	  $control = this.$classify.find('.bsc-' + group);
	  list = this.conf[group];
	  item = _.find(list, function(i) { return i.id === id; });
	  name = !_.isUndefined(item) ? item.name : id;

	  compiled = this.tpl.checkbox({ name: group, id: id, label: id, title: name, css: 'active', size: this.options.btnsize });
	  $control.append(compiled);
	}
      }, this);
    },


    initFGI: function () {
      var buffer = [], items = [], active, compiled, $btn;

      this.$typemenu.show();

      _.each(this.conf.types, function (obj, key) {
	active = key === this.getType() ? ' active' : '';
	compiled = this.tpl.list({ id: key, label: obj.label, title: obj.label, css: 'bs-class-type' + active });
	buffer.push(compiled);
      }, this);

      this.$typemenu.find('ul').append(buffer);

      buffer = [];
      items = _.without(_.union(this.get('fgisourceopen'), this.get('ownerproducer')), 'USA');

      _.each(items, function (id) {
	$btn = this.$fgi.find('.btn-' + id);
	if (!$btn.length) {
	  compiled = this.tpl.checkbox({ name: 'fgi', id: id, label: id, title: id, css: 'active', size: this.options.btnsize });
	  buffer.push(compiled);
	}
      }, this);

      this.$fgi.append(buffer);

      this.$typemenu.on('click', '.bs-class-type', $.proxy(this.typeClickHandler, this));
    },


    /*!
     * Toggles typeahead input type to either relto or fgi
     */
    inputHandler: function (e) {
      e.preventDefault();
      var $el = $(e.target);
      var id = $el.attr('data-type');
      if (!$el.parent('li').hasClass('disabled')) { this.toggleTypeahead(id); }
    },


    /*!
     * Adds trigraphs and tetragraphs from the options to the typeahead data
     */
    initTypeaheadData: function () {
      _.each(this.conf.trigraphs, function (val, key) {
	this.typeahead.data.push(val.name + ' | ' + key);
      }, this);

      _.each(this.conf.tetragraphs, function (val, key) {
	this.typeahead.data.push(val.name + ' | ' + key);
      }, this);
    },


    /*!
     * Switches typeahead input state between RELTO and FGI
     *
     * @param	{string} mode (default=relto|fgi)	which input type to activate
     */
    toggleTypeahead: function (mode) {
      if (this.options.relto || this.options.fgi) {

	var params = {
	  mode: mode || 'relto',
	  label: this.typeahead.relto.label,
	  input: this.typeahead.relto.active ? '' : 'disabled',
	  cssrel: this.typeahead.relto.active ? 'active' : 'disabled',
	  cssfgi: this.typeahead.fgi.active ? '' : 'disabled',
	  toggle: this.typeahead.relto.enabled && (this.typeahead.fgi.enabled && this.typeahead.fgi.active) ? true : false,
	  visible: (this.typeahead.relto.enabled && this.typeahead.relto.active) || (this.typeahead.fgi.enabled && this.typeahead.fgi.active) ? true : false
	};

	if (mode === 'fgi' || (!this.typeahead.relto.active && this.typeahead.fgi.enabled)) {
	  _.extend(params, {
	    mode: 'fgi',
	    label: this.typeahead.fgi.label,
	    input: this.typeahead.fgi.active ? '' : 'disabled',
	    cssrel: this.typeahead.relto.active ? '' : 'disabled',
	    cssfgi: this.typeahead.fgi.active ? 'active' : 'disabled'
	  });
	}

	//console.log('toggleTypeahead', this.typeahead, mode, params);

	if (params.visible) {
	  this.$typeahead.html(this.tpl.input(params)).show();
	  this.initTypeahead(params);
	} else {
	  this.destroyTypeahead();
	}
      }
    },


    /*destroy: function () {
     this.$element.empty();
     this.$savebtn.off();
     this.$buttonGroups.off();
     this.$typeahead.off();
     this.$element.removeData();
     this.destroyTypeahead();
     },*/

    destroyTypeahead: function () {
      //console.log('destroyTypeahead', this.$typeaheadInput);
      this.$typeahead.hide().empty();
    },


    /*!
     * Initialize typeahead input
     */
    initTypeahead: function (args) {

      this.$typeaheadInput = this.$typeahead.find('input');

      //console.log('initTypeahead', this.$typeaheadInput, _.isFunction(this.$typeaheadInput.typeahead), args);

      if (_.isFunction(this.$typeaheadInput.typeahead)) {

	this.$typeaheadInput.typeahead({
	  source: this.typeahead.data,
	  updater: function (item) {

	    var items = item.split(' | ');
	    var name = items[0];
	    var id = items[1];
	    var compiled, $control, $btn;

	    if (args.mode === 'fgi') {
	      $control = this.$fgi;
	    } else {
	      $control = (id.length > 3) ? this.$tetragraphs : this.$trigraphs;
	    }

	    //console.log(this.typeahead.mode, args.mode, $control, id);

	    $btn = $control.children('.btn-' + id);

	    if (!$btn.length) {
	      compiled = this.tpl.checkbox({ name: args.mode, id: id, label: id, title: name, css: 'active', size: this.options.btnsize });
	      $control.append(compiled);
	    } else {
	      $btn.addClass('active');
	    }

	    if (args.mode === 'fgi') { this.updateFGI(); }

	    this.$typeaheadInput.val('');

	    this.updateClassification();
	  }.bind(this)
	});
      }
    },


    /*!
     * Save button handler; fires callback if defined
     */
    save: function () {
      this.$element.data(this.getData());

      //console.log('save', this.getData(),this.options.mode);

      // set text/input value to current marking
      if (this.options.update && this.isInput) {
	// trigger change event after setting input value;
	this.$element.val(this.getMarking()).change();
      } else if (this.options.update) {
	this.$element.text(this.getMarking());
      }

      // if target element has the `label` class update it with the current classifcation class
      if (this.options.update && this.$element.hasClass('label')) {
	var label = this.conf.classification[this.getClassification()].label;
	this.$element.removeClass('label-default ' + this.classLabels).addClass(label);
      }

      // callback with the classification data object
      if (_.isFunction(this.options.callback)) {
	this.options.callback(this.getData(), this.$element);
      }

      if (this.options.mode === 'modal' && this.$modal) {
	this.$modal.modal('hide');
      } else {
	this.$element.popover('hide');
      }
    },


    showFGI: function () {
      return this.getType() !== 'USONLY' && !this.get('fgisourceprotected').length;
    },


    /*!
     * Remove all button elements for a given jQuery context
     */
    removeButtons: function ($ctx) {
      $ctx.find('.btn').each(function () { $(this).remove(); });
    },


    /*!
     * Reset button states by removing active & disabled class/attribute
     * @param {$jQuery} context to parse for buttons (defaul=all button groups)
     */
    resetButtons: function ($ctx) {
      $ctx = $ctx || this.$resetGroups;
      $ctx.find('.btn').each(function () {
	$(this).removeClass('active disabled').removeAttr('disabled');
      });
    },


    /*!
     * Reset all buttons & set default classification/FGI type values
     */
    resetState: function () {
      this.resetData();
      this.setTypeDefaults();
      this.resetButtons();
      //this.toggleNonICControls(false);
    },


    /*!
     * Set each data item to empty
     */
    resetData: function () {
      _.each(['scicontrols','disseminationcontrols','nonicmarkings','releasableto'], function (key) {
	this.set(key, []);
      }, this);
    },


    /*!
     * Enable/disable save button
     * @param {bool} is save button active?
     */
    toggleSave: function (isActive) {
      if (isActive) {
	this.$savebtn.removeClass('disabled').removeAttr('disabled');
      } else {
	this.$savebtn.addClass('disabled').attr('disabled','disabled');
      }
    },


    /*!
     * Show/hide controls
     */
    toggleControl: function (isVisible, $colCtx, $resetCtx, $removeCtx) {
      $resetCtx = $resetCtx || false;
      $removeCtx = $removeCtx || false;
      if (isVisible) {
	$colCtx.show();
      } else {
	$colCtx.hide();
	if ($resetCtx) {
	  this.resetButtons($resetCtx);
	}
	if ($removeCtx) {
	  this.removeButtons($removeCtx);
	}
      }
    },

    toggleFGIControls: function (bool) {
      if (this.options.fgi) {
	this.toggleControl(bool, this.$colfgi, this.$fgi, false, this.$fgi);
      }
    },

    toggleNonICControls: function (bool) {
      if (this.options.nonic) {
	this.toggleControl(bool, this.$colnonic, this.$nonic);
      }
    },

    toggleRelToControls: function (bool) {
      this.toggleControl(bool, this.$colrelto, this.$relto);
    },


    /*!
     * Show/hide RELTO controls based on whether Dissem contains REL
     */
    toggleRelTo: function () {
      if (this.options.relto) {
	//console.log('toggleRelTo', this.hasDissem('REL'));

	if (this.hasDissem('REL')) {
	  this.typeahead.mode = 'relto';
	  this.typeahead.relto.active = true;
	  this.toggleRelToControls(true);

	  // make sure there is at least on releasableTo country if REL TO is selected
	  if (this.get('releasableto').length <= 1 && _.contains(this.get('releasableto'), 'USA')) {
	    this.errors.push('A REL TO country is required');
	  }

	} else {
	  this.set('releasableto', []);
	  this.typeahead.relto.active = false;
	  this.toggleRelToControls(false);
	}
      }
    },


    /*!
     * Enables/disables type menu options and shows/hides FGI column
     */
    toggleTypeControls: function () {
      if (this.options.fgi) {
	var type = this.getActiveType();
	var isActive;

	//console.log('toggleTypeControls', type);

	_.each(this.conf.types, function (val, key) {
	  isActive = _.contains(val.clsf, this.getClassification());
	  this.toggleTypeOption(key, isActive);
	}, this);

	if (type !== 'USONLY' && !this.get('fgisourceprotected').length) {
	  this.toggleFGIControls(true);
	} else {
	  this.toggleFGIControls(false);
	}
      }
    },

    toggleTypeOption: function (id, isEnabled) {
      var $el = this.$typemenu.find('.'+id);
      if (isEnabled) {
	$el.removeClass('disabled');
      } else {
	$el.addClass('disabled');
      }
    },


    /*!
     * Handle click event for changing the classification type
     */
    typeClickHandler: function (e) {
      e.preventDefault();

      var $el = $(e.target);
      var id = $el.attr('data-value');

      if ($el.parent('li').hasClass('disabled')) { return; }

      switch(id) {
      case 'USONLY':
      case 'USFGIPROT':
      case 'FGIPROT':
	this.typeahead.fgi.enabled = false;
	this.typeahead.fgi.active = false;
	this.typeahead.mode = undefined;
	break;
      case 'JOINT':
      case 'USFGIOPEN':
      case 'FGIOPEN':
	this.typeahead.fgi.enabled = true;
	this.typeahead.fgi.active = true;
	this.typeahead.mode = 'fgi';
	break;
      }

      //console.log('toggleType', id);

      this.setTypeDefaults(id);
      this.resetData();
      this.resetButtons();
      this.enforceRequirements('types', id, this.typeahead.fgi.enabled);
      this.updateClassification();
    },


    /*!
     * Return the currently selected classification type
     */
    getActiveType: function () {
      var id = 'USONLY';
      this.$typemenu.find('.bs-class-type.active').each(function () {
	id = $(this).children('a').attr('data-value');
      });

      return id;
    },

    setActiveType: function (id) {
      this.$typemenu.find('li').removeClass('active');
      this.$typemenu.find('.bs-class-type.' + id).addClass('active');
    },

    /*!
     * Set OwnerProducer/FGI default values
     */
    setTypeDefaults: function (id) {
      id = id || 'USONLY';
      var type = this.conf.types[id];

      if (type) {
	this.set('ownerproducer', _.clone(type.ownerproducer));
	this.set('fgisourceopen',  _.clone(type.fgisourceopen));
	this.set('fgisourceprotected', _.clone(type.fgisourceprotected));
      }	else {
	this.set('ownerproducer', ['USA']);
	this.set('fgisourceopen', []);
	this.set('fgisourceprotected', []);
      }

      if (id === 'USONLY') {
	this.typeahead.fgi.enabled = false;
	this.typeahead.fgi.active = false;
	this.typeahead.mode = undefined;
      }

      this.setActiveType(id);
      //console.log('setTypeDefaults', id, _.clone(this.ism.data));
    },


    /*!
     * Determine currently selected classification type, get active FGI items,
     * and then merge them with the FGI Open/OwnerProducer values;
     */
    updateFGI: function () {
      var type = this.getActiveType();
      var items = this.getActiveItems('fgi');

      //console.log('updateFGI :: type='+type,' | items='+items);

      this.set('fgisourceopen', items);

      if (type === 'JOINT') {
	this.set('ownerproducer', _.union(['USA'], items));
      } else if (type === 'FGIOPEN') {
	this.set('ownerproducer', items);
      }
    },


    /*!
     * Get values of active buttons and returns them as an array
     * @param {string} which control/button group to evaluate
     * @return {array} list of active items
     */
    getActiveItems: function (control) {
      var items = [];
      var $buttons = this.$classify.find('.bsc-' + control + ' .btn.active');

      $buttons.each(function () {
	items.push($(this).attr('data-value'));
      });

      //console.log('getActiveItems', control, items);

      return items;
    },


    /*!
     * Remove markings from the configuration options;
     * useful for dynamically altering available markings
     * @example	[{ scicontrols: ['SI-G','HCS'] }, { disseminationcontrols: ['OC'] }]
     * @param	{array} list of control objects & markings to remove
     */
    without: function (items) {
      var control, markings;
      _.each(items, function (obj) {
	control = _.keys(obj);
	markings = obj[control];
	if (this.conf[control]) {
	  _.each(markings, function (marking) {
	    delete this.conf[control][marking];
	  }, this);
	}
      }, this);
    },


    /*!
     * Show/hide error message
     */
    showErrors: function () {
      var items = this.errors.concat(this.warnings);

      if (!items.length) {
	this.$error.hide();
      } else {
	this.$error.html('');

	_.each(items, function (e) {
	  this.$error.append('&bull; '+e+'<br>');
	}, this);

	this.$error.show();
	this.errors = [];
	this.warnings = [];
      }
    },


    /*!
     *	Button click event handler
     */
    buttonHandler: function (e) {
      e.preventDefault();

      var $btn = $(e.target);
      var id = $btn.attr('data-value');
      var control = $btn.parent().attr('data-control');
      var isDisabled, isActive;

      // wait a brief moment for the Bootstrap button class change to fire
      setTimeout($.proxy(function () {
	isDisabled = $btn.hasClass('disabled');
	isActive = $btn.hasClass('active');

	// only handle button click events if button is not disabled
	if (!isDisabled) {
	  // remove focus when unselecting button
	  if (!isActive) {
	    $btn.blur();
	  }
	  this.buttonAction(control, id, isActive, $btn);
	}
      }, this), 100);
    },


    /*!
     * Performs action based on control type of the button clicked
     * @param {string} control	- the marking control group
     * @param {string} id - the marking id from the data-value attribute
     * @param {bool} isActive - is the button active/selected?
     * @param {jQuery} $ctx - the jQuery context of the button element
     */
    buttonAction: function (control, id, isActive, $ctx) {
      //console.log(control, id, isActive, $ctx);

      switch(control) {
      case 'classification':
	this.setClassification(id);
	// reset state on classification change
	// avoids having to figure out which items are still valid
	this.resetState();
	break;

      case 'scicontrols':
      case 'disseminationcontrols':
      case 'nonicmarkings':
	this.enforceRequirements(control, id, isActive);
	this.set(control, this.getActiveItems(control));
	break;

      case 'fgi':
	this.updateFGI();
	break;

      case 'default':
	// do nothing
	break;
      }

      this.updateClassification();
    },


    /*!
     * Filter which control group buttons show based on the current classification
     * @param {object} list of marking objects to filter
     * @param	{jQuery} control group jQuery context
     * @return {array} list of valid keys
     */
    filterMarkings: function (markings, $control) {
      var validKeys = [];
      var $btn;

      _.each(markings, function (marking, key) {
	$btn = $control.find('.btn-' + key);
	if (_.contains(marking.clsf, this.getClassification())) {
	  $btn.show();
	  validKeys.push(key);
	} else {
	  $btn.removeClass('active').hide();
	}
      }, this);

      return validKeys;
    },


    /*!
     *
     */
    enforcer: function () {
      var $btn, isActive;

      // iterate over currently visible buttons for each control group
      _.each(this.visible, function (values, control) {

	// for each button, if it's active, execute enforceRequirements
	_.each(values, function (key) {
	  $btn = this.$classify.find('.btn-'+key);
	  isActive = $btn.hasClass('active');

	  if ($btn.length && isActive) {
	    this.enforceRequirements(control, key, isActive);
	  }
	}, this);
      }, this);
    },


    /*!
     * Enforce marking relationship compatibility
     * @param {string} control - key of control group to handle
     * @param	{string} id - the marking id
     * @param {bool} isActive - does clicked button have the 'active' class
     */
    enforceRequirements: function (control, id, isActive) {

      var markings = this.conf[control][id];
      var yes = markings.yes || [];
      var no = markings.no || [];
      var a = 'active';
      var d = 'disabled';
      var $btn;

      //console.log('enforceRequirements :: control='+control+' | id='+id+' | isActive='+isActive+' | yes='+yes+' | no='+no);

      // iterate over incompatible markings and ensure they are not active
      _.each(no, function (key) {
	$btn = this.$classify.find('.btn-'+key);
	//console.log('[incompatible]', id, key, $btn.length);

	if ($btn.length) {
	  if (isActive) {
	    if ($btn.hasClass(a)) {
	      this.warnings.push(markings.bl + ' is incompatible with ' + key);
	      $btn.removeClass(a);
	    }
	    $btn.addClass(d).attr(d, d);
	  } else {
	    $btn.removeClass(d).removeAttr(d);
	  }
	}
      }, this);

      // TODO: for each yes item, lookup its disallowed and disable those

      // iterate over required markings and ensure they are active
      _.each(yes, function (key) {
	$btn = this.$classify.find('.btn-'+key);
	//console.log('[required]', id, key, $btn);

	if ($btn.length) {
	  if (isActive) {
	    if (!$btn.hasClass(a)) {
	      this.warnings.push(markings.bl + ' requires ' + key);
	    }
	    $btn.addClass(a+' '+d).attr(d, d);
	  } else {
	    $btn.removeClass(d).removeAttr(d);
	  }
	}
      }, this);
    },


    toggleControls: function () {
      this.visible = {
	scicontrols: this.filterMarkings(this.conf.scicontrols, this.$sci),
	nonicmarkings: this.filterMarkings(this.conf.nonicmarkings, this.$nonic),
	disseminationcontrols: this.filterMarkings(this.conf.disseminationcontrols, this.$dissem)
      };

      //console.log('toggleControls', this.visible);

      this.toggleTypeControls();
      this.toggleControl(this.visible.scicontrols.length, this.$colsci);
      this.toggleNonICControls(this.visible.nonicmarkings.length);
    },


    /*!
     * Update REL TO values, ensuring correct order and parsing tetragraphs
     */
    updateRelTo: function () {
      if (this.options.relto && this.hasDissem('REL')) {

	var trigraphs = this.getActiveItems('trigraphs');
	var tetragraphs = this.getActiveItems('tetragraphs');

	// this is the magic: passes trigraphs & tetragraphs to ISM.js,
	// which will calculate the intersection of the values
	this.setRelTo(_.union(tetragraphs, trigraphs));

	//console.log('updateRelTo', this.get('releasableto'));

	// toggle off all buttons then activate as needed
	this.resetButtons(this.$relto);

	_.each(this.get('releasableto'), function (key) {
	  var $el = this.$relto.find('.btn-' + key);
	  if ($el.length) {
	    $el.addClass('active').removeClass('disabled');
	  }
	}, this);
      }
    },


    /*!
     * Enforces classification rules based on the current classification
     */
    validateRules: function () {

      this.toggleRelTo(); // before toggleTypeahead

      // wait for the call stack to finish execution before continuing
      _.defer(function() {
	//console.log('validateRules', activeType, this.getType(), _.clone(this.ism.data));
	var activeType = this.getActiveType();

	if (activeType !== this.getType()) {
	  this.errors.push(activeType + ' country required');
	}

	if (this.options.fdr) {
	  // enforce FD&R markings in accordance with ICD 710
	  if (this.getClassification() !== 'U' && !this.hasFDR()) {
	    this.errors.push('<abbr title="Foreign Disclosure &amp; Release">FD&amp;R</abbr> marking required (i.e. NF, REL, or RELIDO)');
	  }
	}

	// disable save if there are errors
	this.toggleSave(this.errors.length ? false : true);

	// display any errors (this also clears the error queue)
	this.showErrors();

      }.bind(this));

      this.toggleTypeahead(this.typeahead.mode);
    },


    /*!
     * Enforce classification rules and update the banner
     */
    updateClassification: function (firstRun) {
      this.toggleControls(); // always do this first

      if (firstRun) {
	this.enforcer();
      }

      this.updateRelTo();
      this.validateRules();
      this.renderBanner();
      this.positionPopover();
      //console.log(this.getData());
    },


    /*!
     * Display the classifcation line
     */
    renderBanner: function () {
      var label = this.conf.classification[this.getClassification()].label;
      this.$banner.removeClass(this.classLabels).addClass(label).text(this.getMarking());
    },


    /*!
     * Recalculates popover size and updates its position
     */
    positionPopover: function () {
      var po = this.popover;
      var offset;
      if (po) {
	_.defer(function () {
	  offset = po.getCalculatedOffset(po.options.placement, po.getPosition(), po.$tip.width(), po.$tip.height());
	  po.applyPlacement(offset, po.options.placement);
	});
      }
    },


    /*!
     * ISM.js interface getters & setters
     */

    get: function (key) {
      return this.ism.data[key] ? this.ism.data[key] : [];
    },

    set: function (key, value) {
      this.ism.data[key] = value;
    },

    getType: function () {
      return this.ism.getType();
    },

    getMarking: function () {
      return this.ism.getMarking();
    },

    getData: function () {
      var res = _.clone(this.ism.data);
      res.type = this.ism.type;
      res.marking = this.ism.marking;
      return res;
    },

    setDefaultData: function () {
      var defaults = this.ism.getConfig();
    },

    setRelTo: function (value) {
      this.ism.setReleasableTo(value);
    },

    getClassification: function () {
      return this.ism.data.classification[0];
    },

    setClassification: function (val) {
      this.ism.data.classification = [val];
    },

    hasFDR: function () {
      return this.ism.hasFDRMarking();
    },

    hasDissem: function (val) {
      return this.ism.hasDissemControl(val);
    }

  }; // prototype


  // PLUGIN DEFINITION
  // =================

  function Plugin(options) {
    options = options || {};
    var element = this;

    if (options.selector) {
      element = $(options.selector);
    }

    return element.each(function () {
      var $this = $(this);
      var data = $this.data('bs.classify');
      var opts = $.extend({}, Classify.DEFAULTS, $this.data(), options);

      if (!data) {
	data = new Classify(this, opts);
	$this.data('bs.classify', data);
      }
    });
  }


  var old = $.fn.classify;

  $.fn.classify = Plugin;
  $.fn.classify.Constructor = Classify;

  $.fn.classify.noConflict = function () {
    $.fn.classify = old;
    return this;
  };

  $.fn.classify.markings = {
    classification: {
      U: { bl: 'UNCLASSIFIED', pm: 'U', css: 'btn-success', label: 'label-success' },
      C: { bl: 'CONFIDENTIAL', pm: 'C', css: 'btn-primary', label: 'label-primary' },
      S: { bl: 'SECRET', pm: 'S', css: 'btn-danger', label: 'label-danger' },
      TS: { bl: 'TOP SECRET',	pm: 'TS',	css: 'btn-warning', label: 'label-warning' }
    }
  };

  $.fn.classify.templates = {
    list: _.template('<li class="<%= css %> <%= id %>"><a href="#" title="<%= title %>" data-value="<%= id %>"><%= label %></a></li>'),
    button: _.template('<button type="button" class="btn btn-default btn-<%= size %> btn-<%= id %> <%= css %>" data-value="<%= id %>"><%= label %></button>'),
    radio: _.template('<label class="btn btn-<%= size %> btn-<%= id %> <%= css %>" title="<%= title %>" data-value="<%= id %>"><input type="radio" name="<%= name %>"><%= label %></label>'),
    checkbox: _.template('<label class="btn btn-default btn-<%= size %> btn-<%= id %> <%= css %>" title="<%= title %>" data-value="<%= id %>"><input type="checkbox" name="<%= name %>"><%= label %></label>'),
    input: _.template('<input type="text" class="form-control" placeholder="<%= label %>..." data-provide="typeahead" <%= input %>><div class="input-group-btn"><button type="button" class="btn btn-default dropdown-toggle <%= input %>" <% if (toggle) { %>data-toggle="dropdown"<% } %>><%= label %> <% if (toggle) { %><span class="caret"></span><% } %></button><ul class="dropdown-menu dropdown-menu-right"><li class="<%= cssrel %>"><a href="#" data-type="relto">Rel To</a></li><li class="<%= cssfgi %>"><a href="#" data-type="fgi">FGI</a></li></ul></div>'),
    modal: _.template('<div class="modal" tabindex="-1" role="dialog" id="<%= id %>"><div class="modal-dialog"><div class="modal-content"><% if (title) { %><div class="modal-header"><button type="button" class="close" data-dismiss="modal">&times;</button><h4 class="modal-title"><%= title %></h4></div><% } %><div class="modal-body"><div class="bs-classify"></div></div></div></div></div>'),
    popover: '<div class="popover bs-classify-popover" role="tooltip"><div class="arrow"></div><h3 class="popover-title"></h3><div class="popover-content"></div></div>',
    main: '<div class="label"></div><ul class="alert alert-danger" style="display:none;"></ul><table class="table table-condensed table-bordered"><thead style="display:none;"><tr><th class="bsc-colclassif"><abbr title="Classification">Clsf</abbr></th><th class="bsc-colfgi" style="display:none;"><abbr title="Foreign Government Information Controls">FGI</abbr></th><th class="bsc-colsci"><abbr title="Sensitive Compartmented Information Controls">SCI</abbr></th><th class="bsc-coldissem"><abbr title="Dissemination Controls">Dissem</abbr></th><th class="bsc-colnonic" style="display:none;"><abbr title="Non-IC Markings">Non-IC</abbr></th><th class="bsc-colrelto" style="display:none;"><abbr title="Releasable To">Rel To</abbr></th></tr></thead><tr><td class="bsc-colclassif"><div class="btn-group-vertical bsc-classification" data-control="classification" data-toggle="buttons"></div></td><td class="bsc-colfgi" style="display:none;"><div class="btn-group-vertical bsc-fgi" data-control="fgi" data-toggle="buttons"></div></td><td class="bsc-colsci"><div class="btn-group-vertical bsc-scicontrols" data-control="scicontrols" data-toggle="buttons"></div></td><td class="bsc-coldissem"><div class="btn-group-vertical bsc-disseminationcontrols" data-control="disseminationcontrols" data-toggle="buttons"></div></td><td class="bsc-colnonic" style="display:none;"><div class="btn-group-vertical bsc-nonicmarkings" data-control="nonicmarkings" data-toggle="buttons"></div></td><td class="bsc-colrelto" style="display:none;"><div class="bsc-relto"><div class="btn-group-vertical bsc-trigraphs" data-control="trigraphs" data-toggle="buttons"></div><div class="btn-group-vertical bsc-tetragraphs" data-control="tetragraphs" data-toggle="buttons"></div></div></td></tr></table><div class="form-inline clearfix"><button type="button" class="btn btn-primary bsc-save pull-right"><i class="glyphicon glyphicon-ok"></i></button><div class="btn-group dropup bsc-typemenu" style="display:none;"><button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown">FGI <span class="caret"></span></button><ul class="dropdown-menu"></ul></div><div class="input-group bsc-typeahead"></div></div>'
  };


}(jQuery, window, document));
