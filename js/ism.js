/*!
 * ism.js | Information Security Marking JavaScript Library
 */

if (typeof _ === 'undefined') {
  throw new Error('ISM.js requires Underscore.js');
}

if (typeof ISMConfig === 'undefined') {
  throw new Error('ISM.js requires ism.config.js');
}

(function () {

  'use strict';

  var root = this; //! window

  var ISM = function ISM(data, options) {
    this.options = _.extend(_.clone(ISM.OPTIONS), options || {});
    this.original = _.clone(data);
    this.data = undefined;
    this.marking = undefined;
    this.type = undefined;
    this.isDefault = false;

    if (_.isString(data) && data !== '') {
      this.marking = cleanMarking(data);
      this.deserialize();
    } else if (_.isObject(data) && !_.isEmpty(data)) {
      this.data = normalizeData(data);
      this.serialize();
    } else {
      this.data = getDefaultData();
      this.isDefault = true;
    }

    void 0;
  };

  ISM.VERSION = '0.2.0';

  ISM.CONFIG = window.ISMConfig;

  ISM.OPTIONS = {
    format: 'pm', //! options: <pm|bl>
    camelCaseKeys: false //! if true returns data object keys in camelCase instead of lowercase
  };

  ISM.LOOKUP = {
    FDR: [],
    expandable: [],
    classification: [],
    scicontrols: [],
    disseminationcontrols: [],
    nonicmarkings: [],
    tetragraphs: [],
    trigraphs: []
  };

  _.extend(ISM.LOOKUP, ISM.CONFIG.lookup);

  //! add key values from each control configuration to our lookup
  _.each(ISM.LOOKUP, function (val, key) {
    if (ISM.CONFIG[key]) {
      ISM.LOOKUP[key] = _.keys(ISM.CONFIG[key]);
    }
  });


  //! list of all valid control keys
  ISM.KEYS = ['classification', 'scicontrols', 'disseminationcontrols', 'releasableto', 'nonicmarkings', 'fgisourceopen', 'fgisourceprotected', 'ownerproducer'];

  //! map for camelCased control keys
  ISM.KEY_MAP = {
    scicontrols: 'SCIcontrols',
    disseminationcontrols: 'disseminationControls',
    releasableto: 'releasableTo',
    nonicmarkings: 'nonICmarkings',
    fgisourceopen: 'FGIsourceOpen',
    fgisourceprotected: 'FGIsourceProtected',
    ownerproducer: 'ownerProducer'
  };

  //! list of control keys used in identifyGroup
  ISM.CONTROLS = ['classification', 'scicontrols', 'disseminationcontrols', 'nonicmarkings'];

  //! list of control keys used in enforceRequirements
  ISM.FILTER_KEYS = ['scicontrols', 'disseminationcontrols', 'nonicmarkings'];


  /*!
   * PRIVATE API
   */

  ISM._private = {};

  /*!
   * Cleans & normalizes a classification marking string
   * @param {string} a classification marking
   * @return {string} the sanitized marking
   */
  var cleanMarking = function (str) {

    str = str
      .toUpperCase()
      .replace(/[^A-Z\,\-\s\/]/g, '') //! strip invalid characters
      .replace(/[,]/g, ' ') //! replace commas with spaces
      .replace(/^\s+/, '') //! strip leading whitespace
      .replace(/[\/][\/]+\//g, '//') //! check for too many slashes
      .replace(/\s+/g, ' ') //! remove multiple spaces
      .replace(/\s+$/, ''); //! strip trailing whitespace

    return str;
  };

  ISM._private.cleanMarking = cleanMarking;

  /*!
   * Filters an object to only have non-empty values for whitelisted keys
   * @param {object} an object to filter
   * @return {object} a filtered object without any empty values
   */
  var cleanData = function (obj) {
    var data = {};

    _.each(obj, function (val, key) {
      data[key.toLowerCase()] = val;
    });

    return _.omit(data, function (val, key) {
      return _.isEmpty(val) || !_.contains(ISM.KEYS, key);
    });
  };

  ISM._private.cleanData = cleanData;

  /*!
   * Cleans a data object and normalizes the values to arrays
   * @param {object} an object with ISM values
   * @return {object} normalized object
   */
  var normalizeData = function (obj) {
    //! iterate over the object and convert any string values to arrays
    obj = _.mapObject(cleanData(obj), function (val, key) {
      if (_.isString(val)) {
        return listToArray(cleanMarking(val));
      } else if (_.isArray(val)) {
        return _.flatten(_.map(val, function (item) {
          return listToArray(cleanMarking(item));
        }));
      } else {
        return [];
      }
    });


    return obj;
  };

  ISM._private.normalizeData = normalizeData;

  /*!
   * Splits a classification marking string into an array
   * @param {string} a classification making, e.g. 'U//FOUO'
   * @return {array} an array of values
   */
  var listToArray = function (str, delimiter) {
    delimiter = delimiter || ' ';
    return _.compact((str || '').replace(/[\/,]/g, ' ').split(delimiter));
  };

  ISM._private.listToArray = listToArray;

  /*!
   * Returns an object with default data structures
   * @param {object} (optional) an object to extend
   * @return {object} an object with default key/values
   */
  var getDefaultData = function (obj) {
    return _.defaults(obj || {}, ISM.CONFIG.defaults);
  };

  ISM._private.getDefaultData = getDefaultData;


  /*!
   * Parses an object with ISM values and filters those values
   * @param {object} an object with ISM values
   * @return {object} a valid ISM obeject
   */
  var parseData = function (obj) {


    //! [1] remove empty values
    obj = cleanData(obj);

    //! [2] set default values
    obj = getDefaultData(obj);

    //! [3] enforce marking compatibility
    obj = enforcer(obj);

    obj = _.mapObject(obj, function (val, key) {
      switch (key) {
        case 'scicontrols':
        case 'disseminationcontrols':
        case 'nonicmarkings':
          //! filter values for the current control
          val = filterMarkings(val, key);
          //! filter values for the given classification
          val = filterByClassification(obj.classification, val, key);
          break;
        case 'releasableto':
          if (obj.disseminationcontrols && _.contains(obj.disseminationcontrols, 'REL')) {
            val = filterRelTo(val);
          } else {
            val = [];
          }
          break;
        case 'ownerproducer':
        case 'fgisourceopen':
        case 'fgisourceprotected':
          val = filterFGI(val, key);
          break;
        default:
          val = filterMarkings(val, key);
          break;
      }
      return val;
    });



    obj = enforcer(obj);

    return cleanData(obj);
  };

  ISM._private.parseData = parseData;


  /*!
   * Parses an ISM marking string into an object with ISM values
   * @param {string} a classification making string
   * @return {object} object of identified controls & markings
   */
  var parseMarking = function (marking) {
    var grouped = splitByGroup(marking);
    var result = {};
    var key;

    _.each(grouped, function (item) {
      key = identifyGroup(item);
      result[key] = item;

      //! JOINT & FGI OPEN need to be handled seperately as identifyGroup will see them as 'classification'
      if (_.contains(item, 'JOINT')) {
        result.JOINT = item;

        //! FGI OPEN
      } else if (key === 'classification' && _.size(item) > 1) {
        if (_.contains(item, 'FGI')) {
          result.FGIPROT = item;
        } else {
          result.FGIOPEN = item;
        }
      }
    });


    return result;
  };

  ISM._private.parseMarking = parseMarking;


  /*!
   * Breaks a marking string into an array of arrays
   * first group splits on `//` then each of those on spaces
   * e.g. TS//SI/TK//FGI GBR//NF
   * => [["TS"], ["SI", "TK"], ["FGI", "GBR"], ["NF"]]
   * @param {string} classification marking string
   * @return {array}
   */
  var splitByGroup = function (marking) {
    var result = (marking || '').split('//');
    result = _.chain(result)
      .map(function (item) {
        //! replace slashes & commas with spaces, then split on spaces
        return _.compact(item.replace(/[\/,]/g, ' ').split(' '));
      })
      .filter(function (item) {
        //! remove empty arrays
        return _.size(item);
      })
      .value();
    return result;
  };

  ISM._private.splitByGroup = splitByGroup;


  /*!
   * Tries to identify the control group from an array of markings,
   * and returns the first match found, e.g. ["IMC","NF"] => disseminationcontrols
   * @param {array} a list of markings
   * @return {string} control key
   */
  var identifyGroup = function (array) {
    var result = _.find(ISM.CONTROLS, function (control) {
      return _.some(array, function (item) {
        return _.contains(ISM.LOOKUP[control], item);
      });
    });

    return result;
  };

  ISM._private.identifyGroup = identifyGroup;


  /*!
   * Sorts a list of markings in order of CAPCO precedence
   * (for this to work, markings in the configuration must be in order!)
   * @param {array} list of marking values to sort
   * @param {string} object key name of controls being sorted, e.g. 'scicontrols'
   * @return {array} ordered list of markings
   */
  var sortByPrecedence = function (values, control) {
    var result = [];

    _.each(ISM.LOOKUP[control], function (value, i) {
      if (_.contains(values, value)) {
        result.push(value);
      }
    });

    return result;
  };

  ISM._private.sortByPrecedence = sortByPrecedence;


  /*!
   * Tests whether a list of marking values contains a FD&R marking
   * @param {array} list of marking values, e.g. ['IMC','NF']
   * @return {bool} true/false
   */
  var hasFDR = function (values) {
    var value = _.filter(values, function (item) {
      return _.contains(ISM.LOOKUP.FDR, item);
    });

    return _.size(value) ? true : false;
  };

  ISM._private.hasFDR = hasFDR;


  /*!
   * Checks the data object for a value in a given control, e.g. hasValue('scicontrols', 'TK')
   * @param {string} control to search
   * @param {string} value to search for
   * @param {object} this context
   * @return {bool} true if the value is present
   */
  var hasValue = function (control, value, ctx) {
    return ctx.data[control] ? _.contains(ctx.data[control], value) : false;
  };


  /*!
   * Returns markings formatted as banner line or portion mark values
   * @param {string} data object key, e.g. 'scicontrols'
   * @param {object} context of this instance
   * @return {array} list of formatted values
   */
  var getFormatted = function (control, ctx) {
    return ctx.data[control] ? _.map(ctx.data[control], function (item) {
      return ISM.CONFIG[control][item][ctx.options.format];
    }) : [];
  };

  ISM._private.getFormatted = getFormatted;


  /*!
   * Filters a list of marking values by classification
   * @param {array} classification to filter on, e.g. ['TS']
   * @param {array} list of marking values to filter, e.g. ['SI-G','HCS']
   * @param {string} object key, e.g. 'scicontrols'
   * @return {array} list of valid markings for the given classification
   */
  var filterByClassification = function (classification, values, control) {

    if (_.isEmpty(classification)) {
      throw new Error('[filterByClassification] Argument classification is an empty array.');
    }

    var result = _.chain(values || [])
      .filter(function (item) {
        return _.contains(ISM.CONFIG[control][item].clsf, classification[0]);
      })
      .value();



    return result;
  };

  ISM._private.filterByClassification = filterByClassification;


  /*!
   * Filters a list of marking values returning a sorted list of those that are valid
   * @param {array} list of marking values, e.g. ['SI','TK']
   * @param {string} object key name of LOOKUP control, e.g. 'scicontrols'
   * @return {array} filtered results
   */
  var filterMarkings = function (values, control) {
    var result = _.chain(values || [])
      .compact()
      .unique()
      .filter(function (item) {
        return _.contains(ISM.LOOKUP[control], item);
      })
      .value();

    //! sort the markings
    result = sortByPrecedence(result, control);



    return result;
  };

  ISM._private.filterMarkings = filterMarkings;


  /*!
   * Filters a list of value for valid FGI trigraphs/tetragraphs
   * @param {array} list of trigraphs/tetragraphs, e.g. ['GBR','NATO']
   * @return {array} filtered results
   */
  var filterFGI = function (values, control) {
    return _.chain(values || [])
      .compact()
      .unique()
      .filter(function (item) {
        return _.contains(ISM.LOOKUP.trigraphs, item) || _.contains(ISM.LOOKUP.tetragraphs, item) || (item === 'FGI' && control !== 'fgisourceopen');
      })
      .sortBy(_.identity)
      .sortBy('length')
      .value();
  };

  ISM._private.filterFGI = filterFGI;


  /*!
   * Filters a list of marking values returning only those that are valid Releasable To markings
   * @param {array} list of marking values, e.g. ['REL','USA','GBR','NATO']
   * @return {array} filtered & sorted results
   */
  var filterRelTo = function (values) {
    return _.chain(values || [])
      .compact()
      .unique()
      .without('USA')
      .filter(function (item) {
        //! remove items not contained in lookup
        return _.contains(ISM.LOOKUP.trigraphs, item) || _.contains(ISM.LOOKUP.tetragraphs, item);
      })
      .expandRelTo()
      .combineRelTo()
      .sortBy(_.identity)
      .sortBy('length')
      .unshift('USA')
      .value();
  };

  ISM._private.filterRelTo = filterRelTo;


  /*!
   * Takes a list of RelTo values and expands tetragraphs
   * @param {array} list of trigraphs/tetragraphs, e.g. ['NZL','ACGU','NATO']
   * @return {array} => ['AUS','CAN','GBR','NZL','NATO']
   */
  var expandRelTo = function (values) {

    //! get tetragraphs that can be expanded
    var expandable = _.filter(values, function (item) {
      return _.contains(ISM.CONFIG.lookup.expandable, item);
    });

    //! expand tetragraphs into trigraphs
    var expanded = expandTetragraphs(expandable);

    //! calculate the intersection of the values
    var intersection = _.intersection.apply(this, expanded);

    if (expandable.length) {
      //! rejoin expanded values with any non-expanded values
      values = _.union(values, intersection);
      //! omit the values that were expanded
      values = _.difference(values, expandable);
    }

    return values;
  };

  ISM._private.expandRelTo = expandRelTo;


  /*!
   * Takes a list of RelTo values and replaces any trigraphs that have a matching tetragraph
   * @param {array} list of trigraphs/tetragraphs, e.g. ['AUS','CAN','GBR','DEU']
   * @return {array} => ['DEU','ACGU']
   */
  var combineRelTo = function (values) {

    //! group values into trigraphs & tetragraphs
    var grouped = _.groupBy(values, 'length');
    var trigraphs = grouped['3'] || [];
    var tetragraphs = grouped['4'] || [];
    var matching = [];
    var result;

    //! parse trigraphs for matching tetragraphs
    matching = _.last(findTetragraphs(trigraphs));

    if (matching) {
      tetragraphs.push(matching);
      //! remove trigraphs that had a tetragraph
      trigraphs = _.difference(trigraphs, ISM.CONFIG.tetragraphs[matching].trigraphs);
    }



    //! finally re-join trigraphs & tetragraphs and dedupe
    result = _.union(trigraphs, tetragraphs);

    return result;
  };

  ISM._private.combineRelTo = combineRelTo;


  /*!
   * Find tetragraphs that match the list of provided trigraphs
   * @param {array} a list of trigraphs to lookup
   * @return {array} one or more matching tetragraphs
   */
  var findTetragraphs = function (trigraphs) {

    var result = _.pluck(_.filter(ISM.CONFIG.tetragraphs, function (obj) {
      //! if the trigraphs provided match the trigraphs from the configuration then return the tetragraph id
      return _.size(obj.trigraphs) && !_.size(_.difference(obj.trigraphs, trigraphs));
    }), 'id');

    return result;
  };

  ISM._private.findTetragraphs = findTetragraphs;


  /*!
   * Takes a list of tetragraphs and expands them into a unique list of trigraphs
   * @param {array} a list of tetragraphs
   * @return {array} a unique list of trigraphs
   */
  var expandTetragraphs = function (values) {
    var result = [];
    var tetras = ISM.CONFIG.tetragraphs;

    _.each(values, function (val) {
      //! if value is a valid tetragraph and it has a list of trigraphs
      //! then add those trigrapghs to the return result
      if (tetras[val] && tetras[val].trigraphs) {
        result.push(tetras[val].trigraphs);
      }
    });


    return result;
  };

  ISM._private.expandTetragraphs = expandTetragraphs;


  /*!
   * Determines classification type, e.g. US/JOINT/FGI
   * @param {object} ISM data object
   * @return {string} classification type
   */
  var getTypeFromObject = function (obj) {

    var type = 'USONLY';
    var ownerUS = _.contains(obj.ownerproducer, 'USA') ? true : false;
    var ownerFGI = _.contains(obj.ownerproducer, 'FGI') ? true : false;
    var fgiProt = _.size(obj.fgisourceprotected) ? true : false;
    var sizeOwner = _.size(obj.ownerproducer);
    var sizeOpen = _.size(obj.fgisourceopen);

    if (fgiProt && ownerUS) {
      type = 'USFGIPROT';
    } else if (fgiProt && ownerFGI) {
      type = 'FGIPROT';
    } else if (sizeOwner > 1 && ownerUS) {
      type = 'JOINT';
    } else if (sizeOpen && ownerUS) {
      type = 'USFGIOPEN';
    } else if (!ownerUS && sizeOpen) {
      type = 'FGIOPEN';
    }


    return type;
  };

  ISM._private.getTypeFromObject = getTypeFromObject;


  /*!
   * Returns the classification type of a marking string, i.e. JOINT/FGI/etc
   * @param {string} classification marking string
   * @return {string} the marking type identifier
   */
  var getTypeFromMarking = function (marking) {
    var type = _.find(_.keys(ISM.CONFIG.types), function (key) {
      var regex = ISM.CONFIG.types[key].regex;


      return regex ? marking.match(regex) : false;
    });



    return type || 'USONLY';
  };

  ISM._private.getTypeFromMarking = getTypeFromMarking;


  /*!
   * This deserializer parses US ONLY markings, i.e. ownerProducer is always USA only
   * @param {string} classification marking string
   * @return {object} ISM data object
   */
  var deserializeSimple = function (marking) {
    var data = {};

    //! split the whole marking into an araay of values
    var values = listToArray(marking);



    data.classification = filterMarkings(values, 'classification');
    data.scicontrols = filterMarkings(values, 'scicontrols');
    data.disseminationcontrols = filterMarkings(values, 'disseminationcontrols');
    data.nonicmarkings = filterMarkings(values, 'nonicmarkings');

    if (_.contains(data.disseminationcontrols, 'REL')) {
      data.releasableto = filterRelTo(values);
    }

    return parseData(data);
  };

  ISM._private.deserializeSimple = deserializeSimple;


  /*!
   * This deserializer parses JOINT/FGI markings
   * @param {string} classification marking string
   * @return {object} ISM data object
   */
  var deserializeComplex = function (marking) {
    var data = parseMarking(marking);
    var type = getTypeFromMarking(marking);



    _.each(data, function (val, key) {
      switch (key) {
        case 'disseminationcontrols':
          if (_.contains(val, 'REL')) {
            data.releasableto = filterRelTo(val);
          }
          data[key] = filterMarkings(val, key);
          break;
        case 'JOINT':
          data.ownerproducer = _.chain(filterFGI(val, 'ownerproducer')).without('USA').unshift('USA').value();
          delete data.JOINT;
          break;
        case 'FGIOPEN':
          data.fgisourceopen = filterFGI(val, 'fgisourceopen');
          data.ownerproducer = filterFGI(val, 'ownerproducer');
          delete data.FGIOPEN;
          break;
        case 'FGIPROT':
          data.ownerproducer = ['FGI'];
          data.fgisourceprotected = ['FGI'];
          delete data.FGIPROT;
          break;
        case 'undefined':
          if (type === 'USFGIPROT') {
            data.ownerproducer = ['USA'];
            data.fgisourceprotected = ['FGI'];
          } else if (type === 'USFGIOPEN') {
            data.ownerproducer = ['USA'];
            data.fgisourceopen = filterFGI(val, 'fgisourceopen');
          }
          break;
        default:
          data[key] = filterMarkings(val, key);
          break;
      }
    });

    return parseData(data);
  };

  ISM._private.deserializeComplex = deserializeComplex;


  /*!
   * Rejects disallowed markings or adds required markings based on compatibility rules
   * i.e. REL cannot be with NF or SI-G requires OC
   * @param {object}
   * @param {string} object key name of controls being filtered, e.g. 'scicontrols'
   */
  var enforceRequirements = function (obj, control) {
    var markings = ISM.CONFIG[control];
    var values = obj[control];



    _.each(values, function (item) {

      var invalid = markings[item].no || [];
      var required = markings[item].yes || [];



      _.each(invalid, function (val) {
        var con = identifyGroup([val]);

        if (obj[con]) {
          obj[con] = _.without(obj[con], val);
        }
      });

      _.each(required, function (val) {
        var con = identifyGroup([val]);

        if (!obj[con]) {
          obj[con] = [];
        }
        if (!_.contains(obj[con], val)) {
          obj[con].push(val);
        }
      });
    });

    return obj;
  };

  ISM._private.enforceRequirements = enforceRequirements;


  /*!
   * Runs enforceRequirements for sci/dissem/nonic controls
   * @param {object} ISM data object
   * @return {object} validated ISM data object
   */
  var enforcer = function (obj) {
    _.each(ISM.FILTER_KEYS, function (key) {
      if (obj[key]) {
        obj = enforceRequirements(obj, key);
      }
    });
    return obj;
  };

  ISM._private.enforcer = enforcer;


  /*!
   * Converts object keys to camelCase
   * @param {object} ISM data object
   * @return {object} ISM data object with camelCased keys
   */
  var toCamelKeys = function (obj) {
    var data = {};

    _.each(obj, function (val, key) {
      var camelKey = ISM.KEY_MAP[key];
      if (camelKey) {
        data[camelKey] = val;
      } else {
        data[key] = val;
      }
    });

    return data;
  };

  ISM._private.toCamelKeys = toCamelKeys;


  /*!
   *
   * @param {string} data object key, e.g. 'scicontrols'
   * @param {object} context of this instance
   */
  var setData = function (control, value, ctx) {


    switch (control) {
      case 'classification':
      case 'scicontrols':
      case 'disseminationcontrols':
      case 'nonicmarkings':
        ctx.data[control] = filterMarkings(value, control);
        break;
      case 'releasableto':
        ctx.data[control] = filterRelTo(value);
        break;
    }
  };

  ISM._private.setData = setData;


  //! extend Underscore with our private methods, so they can be used in chaining
  _.mixin(ISM._private);


  /*!
   * PUBLIC API
   */

  //! returns ISM.js configuration
  ISM.prototype.getConfig = function getConfig() {
    return ISM.CONFIG;
  };

  /*!
   * Tests whether an ISM string is a valid classification marking
   * @return {bool} true/false
   */
  ISM.prototype.isValid = function isValid() {
    this.serialize();
    return this.original === this.marking ? true : false;
  };

  //! returns the current classification type, e.g. USONLY/JOINT/FGI
  ISM.prototype.getType = function getType() {
    return this.type;
  };

  //! returns the serialized classification marking string
  ISM.prototype.getMarking = function getMarking() {
    this.serialize();
    return this.marking;
  };

  //! returns the deserialized classification marking object
  ISM.prototype.getMarkingObject = function getMarkingObject() {
    var data = this.deserialize();
    return _.clone(data);
  };

  //!
  /*!
   * Returns the formatted classification as a string, e.g. 'U' or 'UNCLASSIFIED'
   * @return {string} classification marking
   */
  ISM.prototype.getClassification = function getClassification() {
    return _.first(getFormatted('classification', this));
  };

  ISM.prototype.setClassification = function (value) {
    value = _.isArray(value) ? value : [value];
    this.data.classification = filterMarkings(value, 'classification');
  };

  ISM.prototype.getSCIControls = function getSCIControls() {
    return getFormatted('scicontrols', this);
  };

  ISM.prototype.setSCIControls = function setSCIControls(value) {
    value = _.isArray(value) ? value : [value];
    this.data.scicontrols = filterMarkings(value, 'scicontrols');
  };

  ISM.prototype.getDisseminationControls = function getDisseminationControls() {
    return getFormatted('disseminationcontrols', this);
  };

  ISM.prototype.setDisseminationControls = function setDisseminationControls(value) {
    value = _.isArray(value) ? value : [value];
    this.data.disseminationcontrols = filterMarkings(value, 'disseminationcontrols');
  };

  ISM.prototype.getNonICMarkings = function getNonICMarkings() {
    return getFormatted('nonicmarkings', this);
  };

  ISM.prototype.setNonICMarkings = function setNonICMarkings() {
    value = _.isArray(value) ? value : [value];
    this.data.nonicmarkings = filterMarkings(value, 'nonicmarkings');
  };

  ISM.prototype.getReleasableTo = function getReleasableTo() {
    return this.data.releasableto || [];
  };

  ISM.prototype.setReleasableTo = function setReleasableTo(value) {
    value = _.isArray(value) ? value : [value];
    this.data.releasableto = filterRelTo(value);
  };

  ISM.prototype.getOwnerProducer = function getOwnerProducer() {
    return this.data.ownerproducer || [];
  };

  ISM.prototype.getFGISourceOpen = function getFGISourceOpen() {
    return this.data.fgisourceopen || [];
  };

  ISM.prototype.getFGISourceProtected = function getFGISourceProtected() {
    return this.data.fgisourceprotected || [];
  };


  /*!
   * Sorts an array of Dissemination Controls by precedence
   * @param {array} array of dissemination controls, e.g. ['IMC','NF']
   * @return {array} sorted array of Dissemination Controls
   */
  ISM.prototype.sortDissemControls = function sortDissemControls(values) {
    if (!_.isArray(values)) {
      throw new TypeError('[sortDissemControls] Argument must be an array');
    }

    return sortByPrecedence(values, 'disseminationcontrols');
  };


  /*!
   * Tests whether the given value is contained in the Dissemination Controls
   * @param {string} a disseminationControl value
   * @return {bool} returns true if value exists
   */
  ISM.prototype.hasDissemControl = function hasDissemControl(value) {
    if (!this.data) {
      this.deserialize();
    }

    return hasValue('disseminationcontrols', value, this);
  };


  /*!
   * Tests whether an ISM string has a valid Foreign Disclosure & Release marking
   * @return {bool} returns true if marking contains a FD&R marking
   */
  ISM.prototype.hasFDRMarking = function hasFDRMarking() {
    var res = false;

    if (!this.data) {
      this.deserialize();
    }

    if (this.data.disseminationcontrols) {
      res = hasFDR(this.data.disseminationcontrols);
    }

    return res;
  };


  /*!
   * Deserializes an ISM string into an object with ISM properties
   * @param {string} ISM string
   * @return {object} ISM object
   */
  ISM.prototype.deserialize = function deserialize() {

    if (this.marking && !this.type) {
      this.type = getTypeFromMarking(this.marking);
    }

    if (!this.marking || !_.isString(this.marking)) {
      this.serialize();
    }



    if (this.type !== 'USONLY') {
      this.data = deserializeComplex(this.marking, this.type);
    } else {
      this.data = deserializeSimple(this.marking);
    }



    //! determine the classification type
    this.type = getTypeFromObject(this.data);
    this.serialize();

    if (this.options.camelCaseKeys) {
      this.data = toCamelKeys(this.data);
    }

    return this.data;
  };


  /*!
   * Serializes an object with ISM properties into a valid classification marking string
   * @return {string} ISM string
   */
  ISM.prototype.serialize = function serialize() {
    //! Format: Classification//SCI[1]/SCI[n]//SAP//AEA//FGI XXX//Dissem[1]/Dissem[n]//NonIC

    var classif;
    var fisa;
    var relido;
    var relto;
    var sep;

    this.data = parseData(this.data);
    this.type = getTypeFromObject(this.data);



    /*!
     * CLASSIFICATION
     */
    classif = this.getClassification();

    if (this.type === 'FGIPROT') {
      this.marking = '//FGI ' + classif;
    } else if (this.type === 'FGIOPEN') {
      this.marking = '//' + this.data.ownerproducer.join(' ') + ' ' + classif;
    } else if (this.type === 'JOINT') {
      this.marking = '//JOINT ' + classif + ' ' + this.data.ownerproducer.join(' ');
    } else {
      this.marking = classif;
    }

    /*!
     * SCI CONTROLS
     */
    if (_.size(this.data.scicontrols)) {
      this.marking += '//' + this.getSCIControls().join('/');
    }

    /*!
     * MIXED US/FGI
     */
    if (this.type === 'USFGIPROT') {
      this.marking += '//FGI';
    } else if (this.type === 'USFGIOPEN') {
      this.marking += '//FGI ' + this.data.fgisourceopen.join(' ');
    }

    /*!
     * DISSEMINATION CONTROLS
     */
    if (_.size(this.data.disseminationcontrols)) {

      this.marking += '//';

      fisa = _.contains(this.data.disseminationcontrols, 'FISA');
      relido = _.contains(this.data.disseminationcontrols, 'RELIDO');
      relto = _.contains(this.data.disseminationcontrols, 'REL');

      this.data.disseminationcontrols = _.without(this.data.disseminationcontrols, 'FISA', 'RELIDO', 'REL');
      this.marking += this.getDisseminationControls().join('/');

      if (relto && _.size(this.data.releasableto)) {
        sep = this.data.disseminationcontrols.length ? '/' : '';
        this.marking += sep + 'REL TO ' + this.data.releasableto.join(', ');
        this.data.disseminationcontrols.push('REL');
      }

      if (relido) {
        sep = this.data.disseminationcontrols.length ? '/' : '';
        this.marking += sep + 'RELIDO';
        this.data.disseminationcontrols.push('RELIDO');
      }

      if (fisa) {
        sep = this.data.disseminationcontrols.length ? '/' : '';
        this.marking += sep + 'FISA';
        this.data.disseminationcontrols.push('FISA');
      }
    }

    /*!
     * NON-IC MARKINGS
     */
    if (_.size(this.data.nonicmarkings)) {
      this.marking += '//' + this.getNonICMarkings().join('/');
    }

    return this.marking;
  };

  /*!
   * Module export
   */

  function ism(data, options) {
    return new ISM(data, options);
  }

  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = ism;
    }
  } else {
    root.ism = ism;
  }

  if (typeof define === 'function' && define.amd) {
    define('ism', [], function () {
      return ism;
    });
  }

}.call(this));

/*! UNCLASSIFIED */
