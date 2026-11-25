"""ServiceNow converter and AI-edit tests: no database needed. The flow tests are in test_sn_flow.py."""
from __future__ import annotations

import pytest

from app.sn_html import article_content, image_ids, to_lines

BASE = "https://support.k12.ttu.edu/"


def test_legacy_k12_table_keeps_only_the_content():
    html = """<p><table><tbody>
      <tr><td><p>Title:</p></td><td><p>What browsers work?</p></td></tr>
      <tr><td><p>Location:</p></td><td><p>K-12 KB / SHP</p></td></tr>
      <tr><td><p>Last Updated:</p></td><td><p>07/09/2018</p></td></tr>
      <tr><td><p>Content:</p></td><td><p>First paragraph.</p><p>Second <a href="/kb_view.do?sysparm_article=KB1">link</a>.</p></td></tr>
      <tr><td><p>Article Keywords:</p></td><td><p>browser</p></td></tr></tbody></table></p>"""
    out = to_lines(html, BASE)
    assert out.splitlines() == ["First paragraph.", "Second [link](https://support.k12.ttu.edu/kb_view.do?sysparm_article=KB1)."]


def test_images_become_asset_lines_and_headings_lists_survive():
    html = """<h2>Inline Grading</h2><h3>Tools</h3>
      <p>Pick a tool: <img alt="Pen" src="/sys_attachment.do?sys_id&#61;D72F29DB8778AA10629A0ED8CEBB3529" /></p>
      <ul><li><strong>Drawing</strong> marks</li><li>Comments<ul><li>Saved</li></ul></li></ul>
      <ol><li>Open</li><li>Grade</li></ol>
      <p><img src="https://media.screensteps.com/x.png"></p>"""
    lines = to_lines(html, BASE).splitlines()
    assert lines[:2] == ["## Inline Grading", "### Tools"]
    assert "Pick a tool:" in lines
    assert "![Pen](sn-asset:d72f29db8778aa10629a0ed8cebb3529)" in lines
    assert "- Drawing marks" in lines and "  - Saved" in lines
    assert "1. Open" in lines and "2. Grade" in lines
    assert "![Image](https://media.screensteps.com/x.png)" in lines
    assert image_ids(html) == {"d72f29db8778aa10629a0ed8cebb3529"}


def test_template_parts_are_merged_and_faq_question_not_repeated():
    art = {"title": "Can I transfer?", "template": "kb_template_faq",
           "parts": [["kb_question", "<p>Can I transfer?</p>"], ["kb_answer", "<p>Yes, within 30 days.</p>"]], "text": ""}
    assert article_content(art, BASE) == "Yes, within 30 days."
    kcs = {"title": "x", "template": "kb_template_incident_kcs_article_html",
           "parts": [["kb_issue", "<p>Login fails</p>"], ["kb_resolution", "<p>Reset it</p>"]], "text": ""}
    assert article_content(kcs, BASE) == "## Issue\nLogin fails\n## Resolution\nReset it"
    empty = {"title": "y", "template": "kb_template_how_to", "parts": [["kb_introduction", ""]], "text": "<p>From text</p>"}
    assert article_content(empty, BASE) == "From text"


def test_ai_edits_apply_exactly_or_fail():
    from app.sn_ai import AIError, apply_edits

    body = "Refunds take 10 days.\n![Form](sn-asset:abc)\nThe fee is $40.\nContact us."
    out = apply_edits(body, [{"find": "The fee is $40.", "replace": "The fee is $50."},
                             {"find": "Contact us.", "replace": "Contact us.\n- Phone: 806-555-0100"}])
    assert out == "Refunds take 10 days.\n![Form](sn-asset:abc)\nThe fee is $50.\nContact us.\n- Phone: 806-555-0100"
    assert apply_edits(body, [{"find": "The  fee is\n$40.", "replace": "x"}]).endswith("x\nContact us.")
    with pytest.raises(AIError):
        apply_edits(body, [{"find": "not in the article", "replace": "x"}])
    with pytest.raises(AIError):
        apply_edits("a\na", [{"find": "a", "replace": "b"}])
