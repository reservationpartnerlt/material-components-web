/**
 * @license
 * Copyright 2017 Google Inc.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

import {assert} from 'chai';
import td from 'testdouble';
import lolex from 'lolex';

import {setupFoundationTest} from '../helpers/setup';
import {verifyDefaultAdapter} from '../helpers/foundation';

import {cssClasses, strings, numbers} from '../../../packages/mdc-dialog/constants';
import {createMockRaf} from '../helpers/raf';
import MDCDialogFoundation from '../../../packages/mdc-dialog/foundation';

suite('MDCDialogFoundation');

test('exports cssClasses', () => {
  assert.deepEqual(MDCDialogFoundation.cssClasses, cssClasses);
});

test('exports strings', () => {
  assert.deepEqual(MDCDialogFoundation.strings, strings);
});

test('exports numbers', () => {
  assert.deepEqual(MDCDialogFoundation.numbers, numbers);
});

test('default adapter returns a complete adapter implementation', () => {
  verifyDefaultAdapter(MDCDialogFoundation, [
    'addClass', 'removeClass', 'addBodyClass', 'removeBodyClass',
    'eventTargetHasClass',
    'computeBoundingRect', 'trapFocus', 'releaseFocus',
    'isContentScrollable', 'areButtonsStacked', 'getActionFromEvent',
    'notifyOpening', 'notifyOpened', 'notifyClosing', 'notifyClosed',
  ]);
});

/**
 * @return {{mockAdapter: !MDCDialogAdapter, foundation: !MDCDialogFoundation}}
 */
function setupTest() {
  const adapterFoundationPair = /** @type {{mockAdapter: !MDCDialogAdapter, foundation: !MDCDialogFoundation}} */ (
    setupFoundationTest(MDCDialogFoundation)
  );
  adapterFoundationPair.foundation.init();
  return adapterFoundationPair;
}

test('#destroy closes the dialog if it is still open', () => {
  const {foundation} = setupTest();
  foundation.close = td.func('close');

  foundation.open();
  foundation.destroy();

  td.verify(foundation.close(strings.DESTROY_ACTION));
});

test('#destroy removes animating classes if called when the dialog is animating', () => {
  const {foundation, mockAdapter} = setupTest();

  foundation.open();
  foundation.destroy();

  td.verify(mockAdapter.removeClass(cssClasses.OPENING));
  td.verify(mockAdapter.removeClass(cssClasses.CLOSING));
});

test('#open adds CSS classes', () => {
  const {foundation, mockAdapter} = setupTest();

  foundation.open();

  td.verify(mockAdapter.addClass(cssClasses.OPEN));
  td.verify(mockAdapter.addBodyClass(cssClasses.SCROLL_LOCK));
});

test('#close removes CSS classes', () => {
  const {foundation, mockAdapter} = setupTest();

  foundation.close();

  td.verify(mockAdapter.removeClass(cssClasses.OPEN));
  td.verify(mockAdapter.removeBodyClass(cssClasses.SCROLL_LOCK));
});

test('#open adds the opening class to start an animation, and removes it after the animation is done', () => {
  const {foundation, mockAdapter} = setupTest();
  const clock = lolex.install();

  foundation.open();

  try {
    td.verify(mockAdapter.addClass(cssClasses.OPENING));
    td.verify(mockAdapter.removeClass(cssClasses.OPENING), {times: 0});
    clock.tick(numbers.DIALOG_ANIMATION_OPEN_TIME_MS);
    td.verify(mockAdapter.removeClass(cssClasses.OPENING));
  } finally {
    clock.uninstall();
  }
});

test('#close adds the closing class to start an animation, and removes it after the animation is done', () => {
  const {foundation, mockAdapter} = setupTest();
  const clock = lolex.install();

  foundation.close();

  try {
    td.verify(mockAdapter.addClass(cssClasses.CLOSING));
    td.verify(mockAdapter.removeClass(cssClasses.CLOSING), {times: 0});
    clock.tick(numbers.DIALOG_ANIMATION_OPEN_TIME_MS);
    td.verify(mockAdapter.removeClass(cssClasses.CLOSING));
  } finally {
    clock.uninstall();
  }
});

test('#isOpen returns false when the dialog has never been opened', () => {
  const {foundation} = setupTest();
  assert.isFalse(foundation.isOpen());
});

test('#isOpen returns true when the dialog is open', () => {
  const {foundation} = setupTest();

  foundation.open();

  assert.isTrue(foundation.isOpen());
});

test('#isOpen returns false when the dialog is closed after being open', () => {
  const {foundation} = setupTest();

  foundation.open();
  foundation.close();

  assert.isFalse(foundation.isOpen());
});

test('#open activates focus trapping on the dialog surface', () => {
  const {foundation, mockAdapter} = setupTest();
  const clock = lolex.install();

  foundation.open();

  clock.tick(numbers.DIALOG_ANIMATION_OPEN_TIME_MS);

  try {
    td.verify(mockAdapter.trapFocus());
  } finally {
    clock.uninstall();
  }
});

test('#close deactivates focus trapping on the dialog surface', () => {
  const {foundation, mockAdapter} = setupTest();

  foundation.close();

  td.verify(mockAdapter.releaseFocus());
});

test('#open emits "opening" and "opened" events', () => {
  const {foundation, mockAdapter} = setupTest();
  const clock = lolex.install();

  foundation.open();

  try {
    td.verify(mockAdapter.notifyOpening(), {times: 1});
    clock.tick(numbers.DIALOG_ANIMATION_OPEN_TIME_MS);
    td.verify(mockAdapter.notifyOpened(), {times: 1});
  } finally {
    clock.uninstall();
  }
});

test('#close emits "closing" and "closed" events', () => {
  const {foundation, mockAdapter} = setupTest();
  const clock = lolex.install();

  foundation.close();

  try {
    td.verify(mockAdapter.notifyClosing(''), {times: 1});
    clock.tick(numbers.DIALOG_ANIMATION_CLOSE_TIME_MS);
    td.verify(mockAdapter.notifyClosed(''), {times: 1});

    const action = 'action';
    foundation.close(action);
    td.verify(mockAdapter.notifyClosing(action), {times: 1});
    clock.tick(numbers.DIALOG_ANIMATION_CLOSE_TIME_MS);
    td.verify(mockAdapter.notifyClosed(action), {times: 1});
  } finally {
    clock.uninstall();
  }
});

test('#open recalculates layout', () => {
  const {foundation} = setupTest();
  foundation.layout = td.func('layout');

  foundation.open();

  td.verify(foundation.layout());
});

test('#layout detects stacked buttons', () => {
  const {foundation, mockAdapter} = setupTest();
  const mockRaf = createMockRaf();
  td.when(mockAdapter.areButtonsStacked()).thenReturn(true);

  foundation.layout();
  mockRaf.flush();

  try {
    td.verify(mockAdapter.addClass(cssClasses.STACKED));
  } finally {
    mockRaf.restore();
  }
});

test('#layout detects unstacked buttons', () => {
  const {foundation, mockAdapter} = setupTest();
  const mockRaf = createMockRaf();
  td.when(mockAdapter.areButtonsStacked()).thenReturn(false);

  foundation.layout();
  mockRaf.flush();

  try {
    td.verify(mockAdapter.removeClass(cssClasses.STACKED));
  } finally {
    mockRaf.restore();
  }
});

test(`#layout removes ${cssClasses.STACKED} class before recalculating button stacking`, () => {
  const {foundation, mockAdapter} = setupTest();
  const mockRaf = createMockRaf();
  td.when(mockAdapter.areButtonsStacked()).thenReturn(true);

  foundation.layout();
  mockRaf.flush();

  try {
    td.verify(mockAdapter.removeClass(cssClasses.STACKED));
    td.verify(mockAdapter.addClass(cssClasses.STACKED));
  } finally {
    mockRaf.restore();
  }
});

test('#layout adds scrollable class when content is scrollable', () => {
  const {foundation, mockAdapter} = setupTest();
  const mockRaf = createMockRaf();
  td.when(mockAdapter.isContentScrollable()).thenReturn(true);

  foundation.layout();
  mockRaf.flush();

  try {
    td.verify(mockAdapter.addClass(cssClasses.SCROLLABLE));
  } finally {
    mockRaf.restore();
  }
});

test('#layout removes scrollable class when content is not scrollable', () => {
  const {foundation, mockAdapter} = setupTest();
  const mockRaf = createMockRaf();
  td.when(mockAdapter.isContentScrollable()).thenReturn(false);

  foundation.layout();

  mockRaf.flush();
  td.verify(mockAdapter.removeClass(cssClasses.SCROLLABLE));
  mockRaf.restore();
});

test(`click closes dialog when ${strings.ACTION_ATTRIBUTE} attribute is present`, () => {
  const {foundation, mockAdapter} = setupTest();
  const evt = {target: {}};
  const action = 'action';
  foundation.close = td.func('close');

  td.when(mockAdapter.getActionFromEvent(evt)).thenReturn(action);
  foundation.open();
  foundation.handleClick(evt);

  td.verify(foundation.close(action));
});

test(`click does nothing when ${strings.ACTION_ATTRIBUTE} attribute is not present`, () => {
  const {foundation, mockAdapter} = setupTest();
  const evt = {target: {}};
  foundation.close = td.func('close');

  td.when(mockAdapter.getActionFromEvent(evt)).thenReturn('');
  foundation.open();
  foundation.handleClick(evt);

  td.verify(foundation.close(td.matchers.isA(String)), {times: 0});
});

test(`click closes dialog when ${cssClasses.SCRIM} class is present`, () => {
  const {foundation, mockAdapter} = setupTest();
  const evt = {target: {}};
  foundation.close = td.func('close');
  td.when(mockAdapter.eventTargetHasClass(evt.target, cssClasses.SCRIM)).thenReturn(true);

  foundation.open();
  foundation.handleClick(evt);

  td.verify(foundation.close(foundation.getScrimClickAction()));
});

test(`click does nothing when ${cssClasses.SCRIM} class is present but scrim click action is empty string`, () => {
  const {foundation, mockAdapter} = setupTest();
  const evt = {target: {}};
  foundation.close = td.func('close');
  td.when(mockAdapter.eventTargetHasClass(evt.target, cssClasses.SCRIM)).thenReturn(true);

  foundation.setScrimClickAction('');
  foundation.open();
  foundation.handleClick(evt);

  td.verify(foundation.close(td.matchers.isA(String)), {times: 0});
});

test('escape keydown closes the dialog (via key property)', () => {
  const {foundation} = setupTest();
  foundation.close = td.func('close');

  foundation.open();
  foundation.handleDocumentKeydown({key: 'Escape'});

  td.verify(foundation.close(foundation.getEscapeKeyAction()));
});

test('escape keydown closes the dialog (via keyCode property)', () => {
  const {foundation} = setupTest();
  foundation.close = td.func('close');

  foundation.open();
  foundation.handleDocumentKeydown({keyCode: 27});

  td.verify(foundation.close(foundation.getEscapeKeyAction()));
});

test('escape keydown does nothing if escape key action is set to empty string', () => {
  const {foundation} = setupTest();
  foundation.close = td.func('close');

  foundation.setEscapeKeyAction('');
  foundation.open();
  foundation.handleDocumentKeydown({key: 'Escape'});

  td.verify(foundation.close(foundation.getEscapeKeyAction()), {times: 0});
});

test('keydown does nothing when key other than escape is pressed', () => {
  const {foundation} = setupTest();
  foundation.close = td.func('close');

  foundation.open();
  foundation.handleDocumentKeydown({key: 'Enter'});

  td.verify(foundation.close(foundation.getEscapeKeyAction()), {times: 0});
});
