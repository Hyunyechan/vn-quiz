/* =========================================================
   정답 공개 후 미공개 힌트 보기 패치
   ---------------------------------------------------------
   기존 app.js를 전부 갈아엎지 않고,
   현재 GitHub의 app.js 뒤에 이 파일을 추가로 로드하면 됩니다.

   동작:
   - 정답을 맞혔거나 "정답 보기"를 누르면 문제를 종료 상태로 전환
   - 이미 공개한 힌트/힌트 스택/등급/점수는 그대로 유지
   - 아직 공개하지 않은 힌트 버튼은 다시 활성화
   - 종료 후 힌트를 눌러도 힌트 스택/점수는 변하지 않음
   - 종료 후에도 VOCAL / 노래 제목 / 장르 / 제작진 / CG 확인 가능
========================================================= */

(function(){

  let questionResolved=false;

  /*
    기존 addStack을 보존하고, 정답 공개 이후에는
    스택을 증가시키지 않도록 감싼다.
  */
  const originalAddStack=window.addStack;

  if(typeof originalAddStack==="function"){
    window.addStack=function(){

      if(questionResolved){
        // 정답 공개 후에는 스택/등급을 그대로 유지
        if(typeof window.stats==="function"){
          window.stats();
        }
        return;
      }

      return originalAddStack.apply(this,arguments);
    };
  }

  function enableUnusedHints(){

    document
      .querySelectorAll("[data-hint],[data-staff]")
      .forEach(button=>{

        /*
          이미 공개된 힌트는 기존 reveal()이
          used/staffUsed를 검사하므로 다시 눌러도
          중복 공개되지 않는다.

          따라서 여기서는 버튼을 다시 활성화해서
          아직 공개하지 않은 힌트를 선택할 수 있게 한다.
        */
        button.disabled=false;

      });
  }

  function markResolved(){

    questionResolved=true;

    /*
      결과가 나온 뒤 미공개 힌트를 볼 수 있도록
      힌트 버튼만 다시 활성화한다.
    */
    enableUnusedHints();

  }

  /*
    "정답 보기"는 기존 giveUp() 실행 후
    이 리스너가 실행되도록 한다.
  */
  const giveUpButton=document.querySelector("#giveUp");

  if(giveUpButton){

    giveUpButton.addEventListener(
      "click",
      function(){

        setTimeout(
          markResolved,
          0
        );

      }
    );

  }

  /*
    정답 확인 버튼.
    오답일 때는 종료하지 않는다.
    기존 submit() 실행 후 result가 "ok"인지 확인한다.
  */
  const submitButton=document.querySelector("#submit");

  if(submitButton){

    submitButton.addEventListener(
      "click",
      function(){

        setTimeout(
          function(){

            const result=
              document.querySelector("#result");

            if(
              result &&
              result.classList.contains("ok")
            ){
              markResolved();
            }

          },
          0
        );

      }
    );

  }

  /*
    Enter로 정답을 제출하는 경우도 처리한다.
    실제 submit 버튼의 click 이벤트가 이미 발생하므로
    별도 처리는 필요하지 않지만, 브라우저/기존 코드
    변경에 대비해 keydown도 보조적으로 감시한다.
  */
  const answer=document.querySelector("#answer");

  if(answer){

    answer.addEventListener(
      "keydown",
      function(e){

        if(e.key!=="Enter"){
          return;
        }

        setTimeout(
          function(){

            const result=
              document.querySelector("#result");

            if(
              result &&
              result.classList.contains("ok")
            ){
              markResolved();
            }

          },
          10
        );

      }
    );

  }

  /*
    새 문제가 시작되면 다시 정상적으로
    힌트마다 +1이 적용되도록 종료 상태 해제.
  */
  const newGameButton=
    document.querySelector("#newGame");

  if(newGameButton){

    newGameButton.addEventListener(
      "click",
      function(){

        questionResolved=false;

      }
    );

  }

  /*
    모드 변경으로 newGame()이 호출되는 경우에도
    새 문제 상태로 취급한다.
  */
  document
    .querySelectorAll(".mode-btn")
    .forEach(button=>{

      button.addEventListener(
        "click",
        function(){

          questionResolved=false;

        }
      );

    });

  const yearSelect=
    document.querySelector("#yearSelect");

  if(yearSelect){

    yearSelect.addEventListener(
      "change",
      function(){

        questionResolved=false;

      }
    );

  }

})();
