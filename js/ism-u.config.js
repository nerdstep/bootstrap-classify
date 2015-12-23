/*!
 * ISM.js NIPRNet Configuration
 */

window.ISMConfig = window.ISMConfig || {};

(function ($) {

    window.ISMConfig = Object.assign(true, {}, window.ISMConfig, {

    defaults: {
      classification: ['U'],
      ownerproducer: ['USA']
    },

    lookup: {
      FDR: [],
      expandable: []
    },

    classification: {
      U: {
        bl: 'UNCLASSIFIED',
        pm: 'U'
      }
    },

    scicontrols: {},

    disseminationcontrols: {
      FOUO: {
        bl: 'FOR OFFICIAL USE ONLY',
        pm: 'FOUO',
        clsf: ['U'],
        yes: [],
        no: []
      }
    },

    dissemPriority: ['FOUO'],

    nonicmarkings: {},

    types: {
      USONLY: {
        label: 'US ONLY',
        clsf: ['U'],
        ownerproducer: ['USA'],
        fgisourceopen: [],
        fgisourceprotected: [],
        yes: [],
        no: []
      }
    },

    trigraphs: {},

    tetragraphs: {}

  });

  /*!
   * Module export
   */
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
        exports = module.exports = window.ISMConfig;
    }
  }

}(window.jQuery));
