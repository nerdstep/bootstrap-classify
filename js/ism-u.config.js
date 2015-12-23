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
        FDR: ['NF', 'REL', 'RELIDO'],
        expandable: ['ACGU', 'FVEY']
    },

    classification: {
      U: {
        bl: 'UNCLASSIFIED',
        pm: 'U'
      },
      S: {
        bl: 'SECRET',
        pm: 'S'
      },
      TS: {
        bl: 'TOP SECRET',
        pm: 'TS'
      },
      C: {
        bl: 'CONFIDENTIAL',
        pm: 'C'
      }
    },

    scicontrols: {
        SI: {
            bl: 'SI',
            pm: 'SI',
            clsf: ['C', 'S', 'TS'],
            yes: [],
            no: []
        },
        TK: {
            bl: 'TALENT KEYHOLE',
            pm: 'TK',
            clsf: ['S', 'TS'],
            yes: [],
            no: []
        }
    },

    disseminationcontrols: {
      FOUO: {
        bl: 'FOR OFFICIAL USE ONLY',
        pm: 'FOUO',
        clsf: ['U'],
        yes: [],
        no: []
      },
      NF: {
        bl: 'NOFORN',
        pm: 'NF',
        clsf: ['U', 'C', 'S', 'TS'],
        yes: [],
        no: ['REL', 'RELIDO', 'EYES']
      },
      REL: {
        bl: 'RELTO',
        pm: 'REL',
        clsf: ['U', 'C', 'S', 'TS'],
        yes: [],
        no: ['NF']
      },
      RELIDO: {
        bl: 'RELIDO',
        pm: 'RELIDO',
        clsf: ['U', 'C', 'S', 'TS'],
        yes: [],
        no: ['NF']
      }
    },

    dissemPriority: ['NF', 'RELIDO', 'REL', 'FOUO'],

    nonicmarkings: {
      ABCDE: {
        bl: 'ABCDE',
        pm: 'ABCDE',
        clsf: ['U', 'C', 'S', 'TS'],
        yes: [],
        no: ['NF']
      }
    },

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

    trigraphs: {
        USA: {
            name: 'United States of America',
            id: 'USA'
        },
        AUS: {
            name: 'Australia',
            id: 'AUS'
        }
    },

    tetragraphs: {
        FEYE: {
            name: 'FOR EYES',
            id: 'FEYE',
            trigraphs: ['AUS']
        },
        NATO: {
            name: 'North Atlantic Treaty Organiztion',
            id: 'NATO'
        }
    }

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
