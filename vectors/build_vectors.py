#!/usr/bin/env python3
"""Build vectors/lomboktemplate-vectors-v1.json.

Expected values are written by hand from docs/SPEC_LombokTemplate_v0.1.0.md, not
copied from any implementation's output. Every port runs every case and must
produce exactly `expected`.

Case fields:
  id        unique, stable
  template  template source
  data      root data (JSON)
  partials  optional {name: source}
  options   optional {"strict": bool}
  expected  {"output": str} or {"error": CODE}
"""
import hashlib
import json
import pathlib

CASES = []


def case(id, template, data=None, expected=None, error=None, partials=None, strict=None):
    c = {"id": id, "template": template, "data": data}
    if partials is not None:
        c["partials"] = partials
    if strict is not None:
        c["options"] = {"strict": strict}
    c["expected"] = {"error": error} if error is not None else {"output": expected}
    CASES.append(c)


# --- 2/3. Scanning, standalone lines, whitespace control ------------------------
case("scan-plain-text", "hello world", None, "hello world")
case("scan-empty", "", None, "")
case("scan-single-brace", "a { b } c", None, "a { b } c")
case("scan-unclosed-tag", "a {{ b", None, error="SYNTAX")
case("scan-unclosed-triple", "a {{{ b }}", None, error="SYNTAX")
case("scan-empty-tag", "a {{ }} b", None, error="SYNTAX")
case("scan-delimiter-change", "{{=<% %>=}}", None, error="SYNTAX")
case("comment-inline", "a{{! note }}b", None, "ab")
case("comment-long", "a{{!-- has }} inside --}}b", None, "ab")
case("comment-long-unclosed", "a{{!-- open", None, error="SYNTAX")
case("standalone-section-lines", "x\n{{#a}}\nin\n{{/a}}\ny", {"a": True}, "x\nin\ny")
case("standalone-indented", "x\n  {{#a}}\n  in\n  {{/a}}\ny", {"a": True}, "x\n  in\ny")
case("standalone-crlf", "x\r\n{{#a}}\r\nin\r\n{{/a}}\r\ny", {"a": True}, "x\r\nin\r\ny")
case("standalone-comment", "a\n{{! c }}\nb", None, "a\nb")
case("standalone-at-start", "{{#a}}\nin\n{{/a}}", {"a": True}, "in\n")
case("standalone-at-end-no-newline", "in\n{{#a}}{{/a}}", {"a": True}, "in\n")
case("not-standalone-with-text", "x {{#a}}in{{/a}} y", {"a": True}, "x in y")
case("not-standalone-two-tags", "{{#a}}{{/a}}\nz", {"a": True}, "\nz")
case("variable-not-standalone", "a\n  {{v}}\nb", {"v": "V"}, "a\n  V\nb")
case("else-standalone", "{{#if a}}\nyes\n{{else}}\nno\n{{/if}}\n", {"a": False}, "no\n")
case("trim-before", "a   \n {{~v}}", {"v": "V"}, "aV")
case("trim-after", "{{v~}}  \n  b", {"v": "V"}, "Vb")
case("trim-both-block", "<ul>\n  {{~#each xs~}}\n  <li>{{.}}</li>\n  {{~/each~}}\n</ul>", {"xs": [1, 2]}, "<ul><li>1</li><li>2</li></ul>")

# --- 4. Expressions -------------------------------------------------------------
case("path-simple", "{{name}}", {"name": "Lombok"}, "Lombok")
case("path-spaces", "{{  name  }}", {"name": "L"}, "L")
case("path-dotted", "{{a.b.c}}", {"a": {"b": {"c": "deep"}}}, "deep")
case("path-slash", "{{a/b}}", {"a": {"b": "s"}}, "s")
case("path-missing", "[{{nope}}]", {}, "[]")
case("path-broken-chain", "[{{a.b.c}}]", {"a": {}}, "[]")
case("path-array-index", "{{xs.1}}", {"xs": ["a", "b"]}, "b")
case("path-array-length", "{{xs.length}}", {"xs": [1, 2, 3]}, "3")
case("path-string-length-codepoints", "{{s.length}}", {"s": "a\U0001F600b"}, "3")
case("path-bracket-segment", "{{a.[x y]}}", {"a": {"x y": 1}}, error="SYNTAX")
case("path-this", "{{this}}", "root", "root")
case("path-dot", "{{.}}", 5, "5")
case("path-this-prop", "{{this.a}}", {"a": "A"}, "A")
case("path-proto-forbidden", "{{__proto__}}", {}, error="SYNTAX")
case("path-constructor-forbidden", "{{a.constructor}}", {"a": {}}, error="SYNTAX")
case("path-own-property-only", "[{{a.toString}}]", {"a": {}}, "[]")
case("literal-string-single", "{{ 'hi' }}", None, "hi")
case("literal-string-double", '{{ "hi" }}', None, "hi")
case("literal-string-escape", "{{ 'it\\'s' }}", None, "it&#39;s")
case("literal-number", "{{ 42 }}", None, "42")
case("literal-negative-float", "{{ -1.5 }}", None, "-1.5")
case("literal-true", "{{ true }}", None, "true")
case("literal-null", "[{{ null }}]", None, "[]")
case("helper-call", "{{eq a 1}}", {"a": 1}, "true")
case("helper-subexpr", "{{#if (gt n 0)}}pos{{else}}nonpos{{/if}}", {"n": 3}, "pos")
case("helper-nested-subexpr", "{{not (eq (add a 1) 3)}}", {"a": 2}, "false")
case("helper-hash-arg", "{{echo 1 x=2}}", None, error="UNKNOWN_HELPER")
case("helper-unknown", "{{nohelper a}}", {"a": 1}, error="UNKNOWN_HELPER")
case("bare-name-is-data-not-helper", "{{upper}}", {"upper": "data"}, "data")
case("filter-simple", "{{ name | upper }}", {"name": "lombok"}, "LOMBOK")
case("filter-arg", "{{ n | add:1 }}", {"n": 1}, "2")
case("filter-arg-space", "{{ n | add: 1 }}", {"n": 1}, "2")
case("filter-chain", "{{ s | trim | upper }}", {"s": "  ab  "}, "AB")
case("filter-two-args", "{{ s | truncate:3,'..' }}", {"s": "abcdef"}, "abc..")
case("filter-on-literal", "{{ 'x' | upper }}", None, "X")
case("filter-unknown", "{{ a | nofilter }}", {"a": 1}, error="UNKNOWN_HELPER")
case("filter-missing-name", "{{ a | }}", {"a": 1}, error="SYNTAX")
case("expr-trailing-garbage", "{{ a ) }}", {"a": 1}, error="SYNTAX")
case("expr-unterminated-string", "{{ 'abc }}", None, error="SYNTAX")
case("expr-unexpected-char", "{{ a ; b }}", None, error="SYNTAX")
case("data-index-outside-block", "[{{@index}}]", None, "[]")

# --- 5/6. Blocks ----------------------------------------------------------------
case("if-true", "{{#if a}}Y{{/if}}", {"a": 1}, "Y")
case("if-false", "{{#if a}}Y{{/if}}", {"a": 0}, "")
case("if-else", "{{#if a}}Y{{else}}N{{/if}}", {"a": ""}, "N")
case("if-else-if", "{{#if a}}A{{else if b}}B{{else}}C{{/if}}", {"a": False, "b": True}, "B")
case("if-else-if-fallthrough", "{{#if a}}A{{else if b}}B{{else}}C{{/if}}", {}, "C")
case("if-empty-array-falsy", "{{#if xs}}Y{{else}}N{{/if}}", {"xs": []}, "N")
case("if-empty-object-truthy", "{{#if o}}Y{{else}}N{{/if}}", {"o": {}}, "Y")
case("if-zero-falsy", "{{#if n}}Y{{else}}N{{/if}}", {"n": 0}, "N")
case("if-string-zero-truthy", "{{#if s}}Y{{else}}N{{/if}}", {"s": "0"}, "Y")
case("if-length", "{{#if xs.length}}has{{/if}}", {"xs": [1]}, "has")
case("if-does-not-push-context", "{{#if o}}{{name}}{{/if}}", {"o": {"name": "inner"}, "name": "outer"}, "outer")
case("unless", "{{#unless a}}N{{else}}Y{{/unless}}", {"a": False}, "N")
case("unless-else-if-unsupported", "{{#unless a}}x{{else if b}}y{{/unless}}", {}, error="SYNTAX")
case("if-missing-expr", "{{#if}}x{{/if}}", {}, error="SYNTAX")
case("block-mismatched-close", "{{#if a}}x{{/each}}", {"a": 1}, error="SYNTAX")
case("block-unclosed", "{{#if a}}x", {"a": 1}, error="SYNTAX")
case("block-stray-close", "x{{/if}}", {}, error="SYNTAX")
case("else-outside-block", "{{else}}", {}, error="SYNTAX")
case("double-else", "{{#if a}}1{{else}}2{{else}}3{{/if}}", {"a": 1}, error="SYNTAX")
case("each-array", "{{#each xs}}[{{this}}]{{/each}}", {"xs": ["a", "b"]}, "[a][b]")
case("each-index-first-last", "{{#each xs}}{{@index}}{{#if @first}}F{{/if}}{{#if @last}}L{{/if}};{{/each}}", {"xs": [1, 2, 3]}, "0F;1;2L;")
case("each-index-plus-one", "{{#each xs}}{{ @index | add:1 }}{{/each}}", {"xs": ["a", "b"]}, "12")
case("each-object-keys-in-order", "{{#each o}}{{@key}}={{this}};{{/each}}", {"o": {"b": 1, "a": 2}}, "b=1;a=2;")
case("each-item-fields", "{{#each items}}{{name}}:{{qty}} {{/each}}", {"items": [{"name": "x", "qty": 1}, {"name": "y", "qty": 2}]}, "x:1 y:2 ")
case("each-parent-lookup", "{{#each items}}{{name}}{{../sep}}{{/each}}", {"items": [{"name": "a"}, {"name": "b"}], "sep": ","}, "a,b,")
case("each-fallback-to-outer", "{{#each items}}{{name}}-{{currency}} {{/each}}", {"items": [{"name": "a"}], "currency": "IDR"}, "a-IDR ")
case("each-inner-shadows-outer", "{{#each items}}{{name}}{{/each}}", {"items": [{"name": "in"}], "name": "out"}, "in")
case("each-else-empty", "{{#each xs}}x{{else}}none{{/each}}", {"xs": []}, "none")
case("each-else-missing", "{{#each xs}}x{{else}}none{{/each}}", {}, "none")
case("each-string-is-not-iterable", "{{#each s}}x{{else}}none{{/each}}", {"s": "abc"}, "none")
case("each-nested-index", "{{#each rows}}{{#each this}}{{@../index}}.{{@index}} {{/each}}{{/each}}", {"rows": [[1, 2], [3]]}, "0.0 0.1 1.0 ")
case("each-block-params-unsupported", "{{#each xs as |x|}}{{x}}{{/each}}", {"xs": [1]}, error="UNSUPPORTED")
case("with-pushes-context", "{{#with o}}{{a}}{{/with}}", {"o": {"a": "A"}}, "A")
case("with-else", "{{#with o}}{{a}}{{else}}none{{/with}}", {"o": None}, "none")
case("with-parent", "{{#with o}}{{a}}{{../b}}{{/with}}", {"o": {"a": 1}, "b": 2}, "12")
case("root-var", "{{#each xs}}{{@root.t}}{{/each}}", {"xs": [1, 2], "t": "T"}, "TT")
case("section-object", "{{#o}}{{a}}{{/o}}", {"o": {"a": "A"}}, "A")
case("section-list", "{{#xs}}<{{.}}>{{/xs}}", {"xs": [1, 2]}, "<1><2>")
case("section-false", "{{#o}}x{{/o}}", {"o": False}, "")
case("section-dotted-close", "{{#a.b}}{{c}}{{/a.b}}", {"a": {"b": {"c": 1}}}, "1")
case("section-else-not-allowed", "{{#o}}x{{else}}y{{/o}}", {"o": 1}, error="SYNTAX")
case("inverted-missing", "{{^o}}none{{/o}}", {}, "none")
case("inverted-empty-list", "{{^xs}}none{{/xs}}", {"xs": []}, "none")
case("inverted-present", "{{^o}}none{{/o}}", {"o": 1}, "")
case("caret-else", "{{#if a}}Y{{^}}N{{/if}}", {"a": False}, "N")

# --- 7. Output ------------------------------------------------------------------
case("escape-all", "{{v}}", {"v": "<a href=\"x\" title='y'>&`=</a>"}, "&lt;a href&#61;&quot;x&quot; title&#61;&#39;y&#39;&gt;&amp;&#96;&#61;&lt;/a&gt;")
case("raw-triple", "{{{v}}}", {"v": "<b>"}, "<b>")
case("raw-ampersand", "{{& v}}", {"v": "<b>"}, "<b>")
case("number-integer", "{{n}}", {"n": 3}, "3")
case("number-float", "{{n}}", {"n": 1.25}, "1.25")
case("number-negative-zero", "{{n}}", {"n": -0.0}, "0")
case("bool-output", "{{a}}/{{b}}", {"a": True, "b": False}, "true/false")
case("null-output", "[{{n}}]", {"n": None}, "[]")
case("array-output", "{{xs}}", {"xs": [1, "a", None]}, "1,a,")
case("object-output", "[{{o}}]", {"o": {"a": 1}}, "[]")
case("unicode-passthrough", "{{s}}", {"s": "مرحبا 你好 é"}, "مرحبا 你好 é")
case("strict-missing", "{{nope}}", {}, error="MISSING_VALUE", strict=True)
case("strict-null-ok", "[{{n}}]", {"n": None}, "[]", strict=True)
case("strict-missing-in-if-ok", "{{#if nope}}x{{/if}}ok", {}, "ok", strict=True)

# --- 8. Built-in helpers --------------------------------------------------------
case("eq-strict-types", "{{eq a b}}", {"a": 1, "b": "1"}, "false")
case("eq-null-missing", "{{eq a nope}}", {"a": None}, "true")
case("ne", "{{ne a b}}", {"a": 1, "b": 2}, "true")
case("gt-numbers", "{{gt 2 10}}", None, "false")
case("gt-strings-codepoint", "{{gt 'b' 'a'}}", None, "true")
case("lt-mixed-types-false", "{{lt 1 'a'}}", None, "false")
case("gte-lte", "{{gte 2 2}}{{lte 3 2}}", None, "truefalse")
case("and-or-not", "{{and 1 'x'}}{{or 0 ''}}{{not 0}}", None, "truefalsetrue")
case("and-arity", "{{and 1}}", None, error="HELPER_ERROR")
case("add-strings-numeric", "{{add '1.5' 2}}", None, "3.5")
case("add-non-numeric", "{{add 'x' 1}}", None, error="HELPER_ERROR")
case("sub-mul", "{{sub 5 2}} {{mul 2.5 4}}", None, "3 10")
case("div", "{{div 1 4}}", None, "0.25")
case("div-zero", "{{div 1 0}}", None, error="HELPER_ERROR")
case("default-missing", "{{ c | default:'#1a73e8' }}", {}, "#1a73e8")
case("default-empty-string", "{{ c | default:'x' }}", {"c": ""}, "x")
case("default-zero-kept", "{{ c | default:9 }}", {"c": 0}, "0")
case("upper-unicode", "{{ s | upper }}", {"s": "straße"}, "STRASSE")
case("lower", "{{ s | lower }}", {"s": "ÀB"}, "àb")
case("trim-ascii-only", "[{{ s | trim }}]", {"s": "  x \t"}, "[  x]")
case("truncate-default-suffix", "{{ s | truncate:2 }}", {"s": "abc"}, "ab…")
case("truncate-short", "{{ s | truncate:5 }}", {"s": "abc"}, "abc")
case("truncate-codepoints", "{{ s | truncate:1 }}", {"s": "\U0001F600\U0001F601"}, "\U0001F600…")
case("truncate-bad-length", "{{ s | truncate:-1 }}", {"s": "abc"}, error="HELPER_ERROR")
case("length-filter", "{{ xs | length }}/{{ o | length }}/{{ n | length }}", {"xs": [1, 2], "o": {"a": 1}, "n": 5}, "2/1/0")
case("join", "{{ xs | join:', ' }}", {"xs": ["a", "b"]}, "a, b")
case("join-default-sep", "{{ xs | join }}", {"xs": [1, 2]}, "1,2")
case("nl2br", "{{ s | nl2br }}", {"s": "a<\nb\r\nc"}, "a&lt;<br>b<br>c")
case("raw-filter", "{{ s | raw }}", {"s": "<i>x</i>"}, "<i>x</i>")
case("safeurl-https", "{{ u | safeUrl }}", {"u": "https://x.test/?a=1&b=2"}, "https://x.test/?a&#61;1&amp;b&#61;2")
case("safeurl-javascript", "[{{ u | safeUrl }}]", {"u": "javascript:alert(1)"}, "[]")
case("safeurl-obfuscated", "[{{ u | safeUrl }}]", {"u": " java\tscript:alert(1)"}, "[]")
case("safeurl-relative", "{{ u | safeUrl }}", {"u": "/a/b"}, "/a/b")
case("json-sorted", "{{{ o | json }}}", {"o": {"b": [1, None, True], "a": "x\"y"}}, '{"a":"x\\"y","b":[1,null,true]}')
case("json-escaped-output", "{{ o | json }}", {"o": {"a": 1}}, "{&quot;a&quot;:1}")

# --- Partials -------------------------------------------------------------------
case("partial-basic", "[{{> p}}]", {"x": 1}, "[x=1]", partials={"p": "x={{x}}"})
case("partial-context", "{{> p o}}", {"o": {"x": 2}}, "x=2", partials={"p": "x={{x}}"})
case("partial-missing-lenient", "[{{> nope}}]", {}, "[]")
case("partial-missing-strict", "[{{> nope}}]", {}, error="MISSING_PARTIAL", strict=True)
case("partial-standalone-indent", "a\n  {{> p}}\nb", {}, "a\n  1\n  2\nb", partials={"p": "1\n2\n"})
case("partial-recursion-limit", "{{> r}}", {}, error="LIMIT_EXCEEDED", partials={"r": "x{{> r}}"})
case("partial-recursive-tree", "{{> node}}", {"v": 1, "kids": [{"v": 2, "kids": []}]}, "1(2())", partials={"node": "{{v}}({{#each kids}}{{> node}}{{/each}})"})

# --- Limits and security --------------------------------------------------------
case("depth-limit", "{{#if a}}" * 65 + "{{/if}}" * 65, {"a": 1}, error="LIMIT_EXCEEDED")
case("depth-ok", "{{#if a}}" * 64 + "x" + "{{/if}}" * 64, {"a": 1}, "x")
case("no-code-evaluation", "{{ constructor.constructor }}", {}, error="SYNTAX")


def main():
    out_dir = pathlib.Path(__file__).resolve().parent
    ids = [c["id"] for c in CASES]
    assert len(ids) == len(set(ids)), "duplicate ids"
    doc = {
        "library": "LombokTemplate",
        "version": "1",
        "spec": "docs/SPEC_LombokTemplate_v0.1.0.md",
        "cases": CASES,
    }
    path = out_dir / "lomboktemplate-vectors-v1.json"
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    (out_dir / "SHA256SUMS").write_text(f"{digest}  vectors/{path.name}\n", encoding="utf-8")
    print(f"{len(CASES)} cases, sha256 {digest}")


if __name__ == "__main__":
    main()
