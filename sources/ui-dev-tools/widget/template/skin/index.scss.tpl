/* ==================================================================== *
* Widget style automatically generated on <%= date %>
* npm run add-widget -- --fig=<%= group %>.<%= name %> --dest=<%= dest %>
* ==================================================================== */
@use 'mixins/drumee';

.<%= group %>-<%= name %>{
  &__ui{
    background-color: inherit;
    width:100%;
    width:100%;
  }
  &__main{
    background-color: inherit;
    width:100%;
    width:100%;
  }
  &__container{
    width:100%;
    width:100%;
    padding:20px;
    background-color: inherit;
    justify-content: center;
    align-items: center;
  }
  &__text{
    border: none;
    @include drumee.typo($color: var(--neutral-700), $size: 14px, $line: 24px);
  }
  &__icon{
    height:25px;
    width:25px;
    padding:2px;
  }
}