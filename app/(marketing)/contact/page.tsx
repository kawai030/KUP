import { Faq } from "./_faq";

/** 문의하기 / FAQ — 문의는 이메일로 안내(별도 폼 없음). */
export default function ContactPage() {
  return (
    <section className="section">
      <div className="page-head">
        <span className="kicker">문의하기</span>
        <h1>자주 묻는 질문</h1>
        <p className="lead">계정·가입·서비스 이용 관련 궁금한 점을 모았어요.</p>
      </div>

      <Faq />

      <div className="contact-card">
        <h3>더 궁금한 점이 있나요?</h3>
        <p>
          아래 이메일로 문의해 주시면 확인 후 답변드릴게요.
          <br />
          서비스 오류 제보도 환영합니다.
        </p>
        <a className="contact-email" href="mailto:help@kup.app">
          help@kup.app
        </a>
        <div>
          <a className="btn btn-primary btn-lg" href="mailto:help@kup.app">
            이메일로 문의하기
          </a>
        </div>
      </div>
    </section>
  );
}
