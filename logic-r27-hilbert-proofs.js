'use strict';
// Derivations in Standard's basis: the axioms (H1, H2, H3, Q1, Q2, Q3, E1, E2,
// and what the other connectives abbreviate) and modus ponens, nothing else.
// Used by logic-r27-hilbert-test.js to show, line by line in the app with
// every extension switched off, that the rules the check offers -- conjunction
// elimination, the dilemma, hypothetical syllogism, and the rest -- are
// derivable, so that none of them need be taken as basic.
//
// Derivations in the minimal basis: axioms (H1, H2, H3, the definitions, Q1,
// Q2, Q3, identity) and modus ponens, nothing else. Hypotheses are discharged
// by the deduction theorem, which H1 and H2 make available:
//   h → f, for f an axiom or another hypothesis:  H1, modus ponens.
//   h → h:                                        five lines from H1 and H2.
//   h → C, from h → X and h → (X → C):            H2, modus ponens twice.

// --- formulas --------------------------------------------------------------
const L = n => ({ op: 'letter', name: n });
const BOT = { op: 'bottom' };
const NOT = a => ({ op: 'not', a });
const IMP = (a, b) => ({ op: 'imp', a, b });
const AND = (a, b) => ({ op: 'and', a, b });
const OR = (a, b) => ({ op: 'or', a, b });
const IFF = (a, b) => ({ op: 'iff', a, b });
const ALL = (v, body) => ({ op: 'all', v, body });
const SOME = (v, body) => ({ op: 'some', v, body });
const PR = (name, args) => ({ op: 'pred', name, args });
const print = n => {
    switch (n.op) {
        case 'bottom': return '⊥';
        case 'letter': return n.name;
        case 'pred': return n.name + '(' + n.args.join(',') + ')';
        case 'identity': return n.left + ' = ' + n.right;
        case 'not': return '¬' + (/^(?:pred|letter|not|bottom)$/.test(n.a.op) ? print(n.a) : '(' + print(n.a) + ')');
        case 'and': case 'or': case 'imp': case 'iff': {
            const w = x => /^(?:all|some)$/.test(x.op) ? '(' + print(x) + ')' : print(x);
            return '(' + w(n.a) + ' ' + { and: '∧', or: '∨', imp: '→', iff: '↔' }[n.op] + ' ' + w(n.b) + ')';
        }
        case 'all': case 'some': return (n.op === 'all' ? '∀' : '∃') + n.v + ' (' + print(n.body) + ')';
    }
};
const same = (a, b) => print(a) === print(b);

// --- derivation trees ------------------------------------------------------
// A tree's leaves are axioms or hypotheses; its nodes are modus ponens.
const Ax = f => ({ kind: 'ax', f });
const Hyp = f => ({ kind: 'hyp', f });
// A lemma already proved (a closed tree), spliced into another derivation.
const Use = tree => ({ kind: 'use', tree, f: tree.f });
const Mp = (x, y) => {
    if (!y.f || y.f.op !== 'imp' || !same(y.f.a, x.f)) throw new Error('bad modus ponens: ' + print(x.f) + ' with ' + print(y.f));
    return { kind: 'mp', x, y, f: y.f.b };
};
// The tree for "h → h".
const selfImp = h => {
    const a = Ax(IMP(h, IMP(IMP(h, h), h)));
    const b = Ax(IMP(IMP(h, IMP(IMP(h, h), h)), IMP(IMP(h, IMP(h, h)), IMP(h, h))));
    return Mp(Ax(IMP(h, IMP(h, h))), Mp(a, b));
};
// The deduction theorem: a tree for "h → node.f", keeping any other
// hypotheses open.
function discharge(h, node) {
    switch (node.kind) {
        case 'hyp':
            if (same(node.f, h)) return selfImp(h);
            return Mp(node, Ax(IMP(node.f, IMP(h, node.f))));
        case 'ax': case 'use':
            return Mp(node, Ax(IMP(node.f, IMP(h, node.f))));
        case 'mp': {
            const x = discharge(h, node.x), y = discharge(h, node.y);
            return Mp(x, Mp(y, Ax(IMP(IMP(h, IMP(node.x.f, node.f)), IMP(IMP(h, node.x.f), IMP(h, node.f))))));
        }
    }
    throw new Error('unknown node');
}
// Discharge hypotheses innermost first: "h1 → (h2 → ... → f)".
const deduce = (hyps, node) => hyps.slice().reverse().reduce((n, h) => discharge(h, n), node);

// --- lines -----------------------------------------------------------------
// A tree written out: each line an axiom, or modus ponens on two earlier ones.
class Proof {
    constructor() { this.lines = []; this.at = new Map(); }
    put(f, from) {
        const k = print(f);
        if (this.at.has(k)) return this.at.get(k);
        this.lines.push({ f, from });
        this.at.set(k, this.lines.length - 1);
        return this.lines.length - 1;
    }
    write(node) {
        if (node.kind === 'mp') {
            const i = this.write(node.x), j = this.write(node.y);
            return this.put(node.f, [i, j]);
        }
        if (node.kind === 'use') return this.write(node.tree);
        if (node.kind === 'hyp') throw new Error('undischarged hypothesis: ' + print(node.f));
        return this.put(node.f, 'axiom');
    }
}

module.exports = { L, BOT, NOT, IMP, AND, OR, IFF, ALL, SOME, PR, print, same, Ax, Hyp, Use, Mp, selfImp, discharge, deduce, Proof };
